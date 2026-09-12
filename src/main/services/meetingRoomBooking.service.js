import { Op } from 'sequelize';
import { sequelize } from '../config/database.config.js';
import { MeetingRoom } from '../models/meetingRoom.model.js';
import { MeetingRoomBooking, MEETING_ROOM_BOOKING_STATUSES } from '../models/meetingRoomBooking.model.js';
import { MeetingRoomBookingLog } from '../models/meetingRoomBookingLog.model.js';
import { Notification, Office, User } from '../models/init.model.js';
import NotificationLogService from './notificationLog.service.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import logger from '../utils/winston/logger.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';

const ACTIVE_BOOKING_STATUSES = ['scheduled', 'confirmed', 'in_progress'];
const TERMINAL_BOOKING_STATUSES = ['completed', 'cancelled', 'auto_cancelled'];

/** Часовой пояс бронирований (все даты/время для пользователя — здесь) */
const BOOKING_TIMEZONE = 'Asia/Almaty';

class MeetingRoomBookingService {
  static parseCompanyName(companyName) {
    if (companyName === undefined || companyName === null) {
      return null;
    }

    if (typeof companyName !== 'string') {
      throw new BadRequestError('Company name must be a string');
    }

    const trimmed = companyName.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  static parseDateRange({ date, start_time, end_time }) {
    // Формируем ISO строку для корректного парсинга
    // Добавляем часовой пояс +05:00 для Казахстана, чтобы время парсилось правильно
    // Это гарантирует, что "2025-11-22T09:00:00" будет интерпретировано как 09:00 по времени Казахстана
    const startDateString = date && start_time 
      ? `${date}T${start_time.includes('+') ? start_time : start_time + '+05:00'}` 
      : start_time;
    const endDateString = date && end_time 
      ? `${date}T${end_time.includes('+') ? end_time : end_time + '+05:00'}` 
      : end_time;
    
    const start = startDateString ? new Date(startDateString) : null;
    const end = endDateString ? new Date(endDateString) : null;

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestError('Start time and end time are required and must be valid date strings');
    }

    if (start >= end) {
      throw new BadRequestError('Start time must be before end time');
    }

    return { start, end };
  }

  static buildRoomFilters({ office_id, floor, capacity }) {
    const filters = {};

    if (office_id) {
      filters.office_id = office_id;
    }

    if (floor) {
      filters.floor = floor;
    }

    if (capacity) {
      filters.capacity = { [Op.gte]: capacity };
    }

    filters.isActive = true;
    // Only meeting rooms are bookable; cabinets are excluded from availability
    filters.room_type = 'meeting';

    return filters;
  }

  static buildSlots({ start, end, slotMinutes, bookings = [], roomIsActive = true }) {
    const slots = [];
    const slotLengthMs = slotMinutes * 60 * 1000;

    for (let ts = start.getTime(); ts < end.getTime(); ts += slotLengthMs) {
      const slotStart = new Date(ts);
      const slotEnd = new Date(Math.min(ts + slotLengthMs, end.getTime()));
      const conflict = bookings.find((booking) => (
        new Date(booking.start_time).getTime() < slotEnd.getTime() &&
        new Date(booking.end_time).getTime() > slotStart.getTime()
      ));

      slots.push({
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        is_available: roomIsActive && !conflict,
        booking_id: conflict ? conflict.id : null,
        booking_status: conflict ? conflict.status : null
      });
    }

    return slots;
  }

  static async getAvailability(query) {
    const { start, end } = this.parseDateRange(query);
    const includeFreeSlots = query.include_free_slots === 'true' || query.include_free_slots === true;
    const slotMinutes = query.slot_minutes ? parseInt(query.slot_minutes) : 60;

    if (includeFreeSlots && (Number.isNaN(slotMinutes) || slotMinutes <= 0)) {
      throw new BadRequestError('slot_minutes must be a positive integer when include_free_slots is enabled');
    }
    const filters = this.buildRoomFilters({
      office_id: query.office_id ? parseInt(query.office_id) : null,
      floor: query.floor ? parseInt(query.floor) : null,
      capacity: query.capacity ? parseInt(query.capacity) : null
    });

    const rooms = await MeetingRoom.findAll({
      where: filters,
      include: [
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city']
        }
      ],
      order: [['floor', 'ASC'], ['name', 'ASC']]
    });

    if (rooms.length === 0) {
      return [];
    }

    const roomIds = rooms.map((room) => room.id);
    const overlappingBookings = await MeetingRoomBooking.findAll({
      where: {
        meeting_room_id: { [Op.in]: roomIds },
        status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
        [Op.and]: [
          { start_time: { [Op.lt]: end } },
          { end_time: { [Op.gt]: start } }
        ]
      },
      order: [['start_time', 'ASC']],
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });

    const bookingMap = overlappingBookings.reduce((acc, booking) => {
      if (!acc[booking.meeting_room_id]) {
        acc[booking.meeting_room_id] = [];
      }
      acc[booking.meeting_room_id].push(booking);
      return acc;
    }, {});

    return rooms.map((room) => ({
      ...room.toJSON(),
      availability: {
        is_available: !bookingMap[room.id] || bookingMap[room.id].length === 0,
        conflicts: bookingMap[room.id] || [],
        ...(includeFreeSlots
          ? {
              free_slots: this.buildSlots({
                start,
                end,
                slotMinutes,
                bookings: bookingMap[room.id] || [],
                roomIsActive: room.isActive
              })
            }
          : {})
      }
    }));
  }

  static async getRoomDailyAvailability(roomId, { date, slot_minutes = 60 }) {
    if (!date) {
      throw new BadRequestError('date is required to fetch room availability');
    }

    const slotMinutes = parseInt(slot_minutes);
    if (Number.isNaN(slotMinutes) || slotMinutes <= 0) {
      throw new BadRequestError('slot_minutes must be a positive integer');
    }

    const dayStart = new Date(`${date}T00:00:00+05:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+05:00`);

    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestError('Invalid date supplied');
    }

    const room = await MeetingRoom.findByPk(roomId, {
      include: [
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city']
        }
      ]
    });

    if (!room) {
      throw new NotFoundError(`Meeting room with id ${roomId} not found`);
    }

    const bookings = await MeetingRoomBooking.findAll({
      where: {
        meeting_room_id: roomId,
        status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
        [Op.and]: [
          { start_time: { [Op.lt]: dayEnd } },
          { end_time: { [Op.gt]: dayStart } }
        ]
      },
      order: [['start_time', 'ASC']],
      include: [
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });

    return {
      room: room.toJSON(),
      bookings,
      slots: this.buildSlots({
        start: dayStart,
        end: dayEnd,
        slotMinutes,
        bookings,
        roomIsActive: room.isActive
      })
    };
  }

  static async getBookingWithRelations(id) {
    const booking = await MeetingRoomBooking.findByPk(id, {
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom',
          include: [
            {
              model: Office,
              as: 'office',
              attributes: ['id', 'name', 'city', 'address']
            }
          ]
        },
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city', 'address']
        },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });

    if (!booking) {
      throw new NotFoundError(`Booking with id ${id} not found`);
    }

    return booking;
  }

  static async assertRoomAvailability(roomId, start, end, excludeBookingId = null, transaction = null) {
    const overlap = await MeetingRoomBooking.findOne({
      where: {
        meeting_room_id: roomId,
        status: { [Op.in]: ACTIVE_BOOKING_STATUSES },
        ...(excludeBookingId ? { id: { [Op.ne]: excludeBookingId } } : {}),
        [Op.and]: [
          { start_time: { [Op.lt]: end } },
          { end_time: { [Op.gt]: start } }
        ]
      },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
      skipLocked: Boolean(transaction)
    });

    if (overlap) {
      throw new BadRequestError('This time slot is already booked');
    }
  }

  static async createBooking(clientId, payload) {
    const { meeting_room_id, comment } = payload;
    const { start, end } = this.parseDateRange(payload);
    const normalizedCompanyName = this.parseCompanyName(payload.company_name);

    const room = await MeetingRoom.findByPk(meeting_room_id);
    if (!room) {
      throw new NotFoundError(`Meeting room with id ${meeting_room_id} not found`);
    }

    if (!room.isActive) {
      throw new BadRequestError('This meeting room is inactive and cannot be booked');
    }

    if (room.room_type && room.room_type !== 'meeting') {
      throw new BadRequestError('This room type cannot be booked');
    }

    const tx = await sequelize.transaction();

    try {
      await this.assertRoomAvailability(room.id, start, end, null, tx);

      const booking = await MeetingRoomBooking.create({
        meeting_room_id: room.id,
        office_id: room.office_id,
        client_id: clientId,
        start_time: start,
        end_time: end,
        status: 'scheduled',
        comment: comment || null,
        company_name: normalizedCompanyName,
        tables_remaining: room.capacity || 0
      }, { transaction: tx });

      await MeetingRoomBookingLog.create({
        booking_id: booking.id,
        room_id: room.id,
        office_id: room.office_id,
        actor_id: clientId,
        actor_role: 'client',
        action: 'created',
        to_status: booking.status,
        payload: {
          start_time: start,
          end_time: end,
          comment: comment || null,
          company_name: normalizedCompanyName
        }
      }, { transaction: tx });

      await tx.commit();

      const bookingWithRelations = await this.getBookingWithRelations(booking.id);
      await this.notifyClientBookingCreated(bookingWithRelations);
      return bookingWithRelations;

    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async rescheduleBooking(bookingId, actorId, actorRole, payload) {
    const booking = await MeetingRoomBooking.findByPk(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking with id ${bookingId} not found`);
    }

    if (TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
      throw new BadRequestError('Completed or cancelled bookings cannot be rescheduled');
    }

    if (actorRole === 'client' && booking.client_id !== actorId) {
      throw new ForbiddenError('You can only modify your own bookings');
    }

    const { start, end } = this.parseDateRange(payload);
    const normalizedCompanyName = this.parseCompanyName(payload.company_name ?? booking.company_name);
    const room = await MeetingRoom.findByPk(booking.meeting_room_id);

    if (!room) {
      throw new NotFoundError(`Meeting room with id ${booking.meeting_room_id} not found`);
    }

    if (!room.isActive) {
      throw new BadRequestError('This meeting room is inactive and cannot be rescheduled');
    }

    const tx = await sequelize.transaction();

    try {
      await this.assertRoomAvailability(room.id, start, end, booking.id, tx);

      const previousStatus = booking.status;
      await booking.update({
        start_time: start,
        end_time: end,
        status: booking.status === 'in_progress' ? booking.status : 'scheduled',
        reminder_sent_at: null,
        attendance_confirmed_at: null,
        company_name: normalizedCompanyName
      }, { transaction: tx });

      await MeetingRoomBookingLog.create({
        booking_id: booking.id,
        room_id: room.id,
        office_id: room.office_id,
        actor_id: actorId,
        actor_role: actorRole,
        action: 'rescheduled',
        from_status: previousStatus,
        to_status: booking.status,
        payload: {
          start_time: start,
          end_time: end
        }
      }, { transaction: tx });

      await tx.commit();
      return await this.getBookingWithRelations(booking.id);
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async cancelBooking(bookingId, actorId, actorRole, reason = null) {
    const booking = await MeetingRoomBooking.findByPk(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking with id ${bookingId} not found`);
    }

    if (booking.status === 'cancelled' || booking.status === 'auto_cancelled') {
      return await this.getBookingWithRelations(booking.id);
    }

    if (actorRole === 'client' && booking.client_id !== actorId) {
      throw new ForbiddenError('You can only cancel your own bookings');
    }

    const tx = await sequelize.transaction();

    try {
      const previousStatus = booking.status;
      await booking.update({
        status: 'cancelled',
        cancelled_by: actorRole,
        cancellation_reason: reason || null
      }, { transaction: tx });

      await MeetingRoomBookingLog.create({
        booking_id: booking.id,
        room_id: booking.meeting_room_id,
        office_id: booking.office_id,
        actor_id: actorId,
        actor_role: actorRole,
        action: 'cancelled',
        from_status: previousStatus,
        to_status: 'cancelled',
        payload: reason ? { reason } : null
      }, { transaction: tx });

      await tx.commit();
      return await this.getBookingWithRelations(booking.id);
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async confirmAttendance(bookingId, actorId, actorRole) {
    const booking = await MeetingRoomBooking.findByPk(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking with id ${bookingId} not found`);
    }

    if (actorRole === 'client' && booking.client_id !== actorId) {
      throw new ForbiddenError('You can only confirm your own bookings');
    }

    if (TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
      throw new BadRequestError('Cannot confirm attendance for a completed or cancelled booking');
    }

    const tx = await sequelize.transaction();

    try {
      const previousStatus = booking.status;
      await booking.update({
        status: booking.status === 'scheduled' ? 'confirmed' : booking.status,
        attendance_confirmed_at: new Date()
      }, { transaction: tx });

      await MeetingRoomBookingLog.create({
        booking_id: booking.id,
        room_id: booking.meeting_room_id,
        office_id: booking.office_id,
        actor_id: actorId,
        actor_role: actorRole,
        action: 'attendance_confirmed',
        from_status: previousStatus,
        to_status: booking.status
      }, { transaction: tx });

      await tx.commit();
      return await this.getBookingWithRelations(booking.id);
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async completeExpiredBookings() {
    const now = new Date();
    
    // Находим все активные бронирования, у которых end_time уже прошло
    const expiredBookings = await MeetingRoomBooking.findAll({
      where: {
        status: {
          [Op.in]: ACTIVE_BOOKING_STATUSES
        },
        end_time: {
          [Op.lt]: now
        }
      }
    });

    if (expiredBookings.length === 0) {
      return { completed: 0 };
    }

    const tx = await sequelize.transaction();
    let completedCount = 0;

    try {
      for (const booking of expiredBookings) {
        const previousStatus = booking.status;
        
        // Обновляем статус на completed
        await booking.update({
          status: 'completed'
        }, { transaction: tx });

        // Логируем изменение статуса
        await MeetingRoomBookingLog.create({
          booking_id: booking.id,
          room_id: booking.meeting_room_id,
          office_id: booking.office_id,
          actor_id: null, // Система
          actor_role: 'system',
          action: 'auto_completed',
          from_status: previousStatus,
          to_status: 'completed',
          payload: {
            reason: 'Booking time has expired',
            completed_at: now.toISOString()
          }
        }, { transaction: tx });

        completedCount++;
      }

      await tx.commit();
      
      logger.info('Expired bookings completed', {
        count: completedCount,
        bookingIds: expiredBookings.map(b => b.id)
      });

      return { completed: completedCount };
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  /**
   * statusFilter: 'active' | 'completed' | 'cancelled' — запрос только по выбранному статусу
   * active → scheduled, confirmed, in_progress
   * completed → completed
   * cancelled → cancelled, auto_cancelled
   */
  static async getMyBookings(clientId, { limit = 20, offset = 0, statusFilter = null } = {}) {
    const where = { client_id: clientId };

    if (statusFilter === 'active') {
      where.status = { [Op.in]: ACTIVE_BOOKING_STATUSES };
    } else if (statusFilter === 'completed') {
      where.status = 'completed';
    } else if (statusFilter === 'cancelled') {
      where.status = { [Op.in]: ['cancelled', 'auto_cancelled'] };
    }

    const { rows, count } = await MeetingRoomBooking.findAndCountAll({
      where,
      order: [['start_time', 'ASC']],
      limit,
      offset,
      include: [
        { model: MeetingRoom, as: 'meetingRoom' },
        { model: Office, as: 'office', attributes: ['id', 'name', 'city'] }
      ]
    });

    const total = typeof count === 'number' ? count : count.length;
    const hasMore = offset + rows.length < total;
    return { data: rows, total, hasMore };
  }

  static async getIncomingBookings({ date, office_id, status, limit = 50, offset = 0 }) {
    const where = {};

    if (date) {
      const dayStart = new Date(`${date}T00:00:00+05:00`);
      const dayEnd = new Date(`${date}T23:59:59.999+05:00`);
      where.start_time = { [Op.between]: [dayStart, dayEnd] };
    }

    if (office_id) {
      where.office_id = office_id;
    }

    if (status && MEETING_ROOM_BOOKING_STATUSES.includes(status)) {
      where.status = status;
    }

    return await MeetingRoomBooking.findAll({
      where,
      order: [['start_time', 'ASC']],
      limit,
      offset,
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom'
        },
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city']
        },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });
  }

  static async getAllBookings(filters = {}) {
    return await this.getIncomingBookings(filters);
  }

  // Получить статистику переговорных комнат
  static async getStatistics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const rooms = await MeetingRoom.findAll({
      where: { isActive: true },
      include: [
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city']
        }
      ]
    });

    // Получаем все бронирования за текущий месяц
    const monthBookings = await MeetingRoomBooking.findAll({
      where: {
        start_time: {
          [Op.between]: [monthStart, monthEnd]
        }
      },
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom',
          include: [
            {
              model: Office,
              as: 'office',
              attributes: ['id', 'name', 'city']
            }
          ]
        }
      ]
    });

    // Группируем по комнатам
    const roomStats = rooms.reduce((acc, room) => {
      acc[room.id] = {
        room_id: room.id,
        room_name: room.name,
        office_name: room.office?.name || 'Офис',
        booking_count: 0,
        total_minutes: 0,
        cancellations: 0
      };
      return acc;
    }, {});
    let totalDuration = 0;
    let cancellations = 0;

    monthBookings.forEach(booking => {
      const roomId = booking.meeting_room_id;
      if (!roomStats[roomId]) {
        roomStats[roomId] = {
          room_id: roomId,
          room_name: booking.meetingRoom?.name || `Комната ${roomId}`,
          office_name: booking.meetingRoom?.office?.name || 'Офис',
          booking_count: 0,
          total_minutes: 0,
          cancellations: 0
        };
      }

      roomStats[roomId].booking_count++;
      
      if (booking.status === 'cancelled' || booking.status === 'auto_cancelled') {
        roomStats[roomId].cancellations++;
        cancellations++;
      } else {
        const duration = Math.round((new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60));
        roomStats[roomId].total_minutes += duration;
        totalDuration += duration;
      }
    });

    // Вычисляем процент загрузки (примерно: считаем, что комната может быть забронирована 8 часов в день, 30 дней = 240 часов)
    const maxPossibleHours = 240; // 8 часов * 30 дней
    const roomsArray = Object.values(roomStats).map(stat => {
      const occupiedHours = stat.total_minutes / 60;
      const occupancyPercentage = Math.min(100, Math.round((occupiedHours / maxPossibleHours) * 100));
      return {
        ...stat,
        occupancy_percentage: occupancyPercentage
      };
    });

    const occupancyIndicators = roomsArray.map((room) => ({
      room_id: room.room_id,
      room_name: room.room_name,
      office_name: room.office_name,
      occupancy_percentage: room.occupancy_percentage,
      occupancy_level: room.occupancy_percentage < 40
        ? 'green'
        : room.occupancy_percentage <= 80
          ? 'yellow'
          : 'red'
    }));

    // Самые загруженные комнаты
    const mostLoadedRooms = [...roomsArray]
      .sort((a, b) => b.occupancy_percentage - a.occupancy_percentage)
      .slice(0, 5)
      .map(r => ({
        room_id: r.room_id,
        room_name: r.room_name,
        office_name: r.office_name,
        occupancy_percentage: r.occupancy_percentage
      }));

    // Самые свободные комнаты
    const mostFreeRooms = [...roomsArray]
      .sort((a, b) => a.occupancy_percentage - b.occupancy_percentage)
      .slice(0, 5)
      .map(r => ({
        room_id: r.room_id,
        room_name: r.room_name,
        office_name: r.office_name,
        occupancy_percentage: r.occupancy_percentage
      }));

    // Пиковые часы
    const hourStats = {};
    monthBookings.forEach(booking => {
      if (booking.status !== 'cancelled' && booking.status !== 'auto_cancelled') {
        const hour = new Date(booking.start_time).getHours();
        hourStats[hour] = (hourStats[hour] || 0) + 1;
      }
    });

    const peakHours = Object.entries(hourStats)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        booking_count: count
      }))
      .sort((a, b) => b.booking_count - a.booking_count);

    // Средняя продолжительность
    const activeBookings = monthBookings.filter(b => 
      b.status !== 'cancelled' && b.status !== 'auto_cancelled'
    );
    const averageDuration = activeBookings.length > 0
      ? Math.round(totalDuration / activeBookings.length)
      : 0;

    return {
      mostLoadedRooms,
      mostFreeRooms,
      peakHours,
      averageBookingDuration: averageDuration,
      totalBookingsThisMonth: monthBookings.length,
      cancellationsAndNoShows: cancellations,
      occupancyIndicators
    };
  }

  // Получить календарь загрузки по дням (дата — день в Asia/Almaty)
  static async getDailyCalendar(date) {
    const dayStart = new Date(`${date}T00:00:00+05:00`);
    const dayEnd = new Date(`${date}T23:59:59.999+05:00`);

    // Получаем все комнаты
    const rooms = await MeetingRoom.findAll({
      where: { isActive: true },
      include: [
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city']
        }
      ]
    });

    // Получаем все бронирования на эту дату
    const bookings = await MeetingRoomBooking.findAll({
      where: {
        start_time: {
          [Op.between]: [dayStart, dayEnd]
        }
      },
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom'
        },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });

    // Формируем слоты для каждой комнаты (9:00 - 18:00, по часам)
    const roomsData = await Promise.all(rooms.map(async (room) => {
      const roomBookings = bookings.filter(b => b.meeting_room_id === room.id);
      const slots = [];

      // Генерируем слоты с 9:00 до 18:00 по времени Almaty
      for (let hour = 9; hour <= 18; hour++) {
        const slotStart = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00+05:00`);
        const slotEnd = new Date(`${date}T${(hour + 1).toString().padStart(2, '0')}:00:00+05:00`);
        
        const isBooked = roomBookings.some(booking => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          return bookingStart < slotEnd && bookingEnd > slotStart &&
                 booking.status !== 'cancelled' && booking.status !== 'auto_cancelled';
        });

        const booking = isBooked ? roomBookings.find(b => {
          const bookingStart = new Date(b.start_time);
          const bookingEnd = new Date(b.end_time);
          return bookingStart < slotEnd && bookingEnd > slotStart &&
                 b.status !== 'cancelled' && b.status !== 'auto_cancelled';
        }) : null;

        slots.push({
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          is_available: !isBooked,
          booking_id: booking?.id || null,
          booking_status: booking?.status || null,
          booking_user: booking?.client ? {
            id: booking.client.id,
            full_name: booking.client.full_name,
            phone: booking.client.phone
          } : null,
          company_name: booking?.company_name || null
        });
      }

      return {
        room_id: room.id,
        room_name: room.name,
        office_name: room.office?.name || 'Офис',
        slots
      };
    }));

    return {
      date,
      rooms: roomsData
    };
  }

  // Получить календарь загрузки по неделям
  static async scanQRCode(bookingId, executorId) {
    const booking = await MeetingRoomBooking.findByPk(bookingId, {
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom',
          attributes: ['id', 'name', 'capacity']
        }
      ]
    });

    if (!booking) {
      throw new NotFoundError(`Booking with id ${bookingId} not found`);
    }

    if (booking.tables_remaining <= 0) {
      throw new BadRequestError('No tables remaining for this booking');
    }

    // Уменьшаем количество оставшихся столов
    booking.tables_remaining = booking.tables_remaining - 1;
    await booking.save();

    // Логируем действие
    await MeetingRoomBookingLog.create({
      booking_id: booking.id,
      room_id: booking.meeting_room_id,
      office_id: booking.office_id,
      actor_id: executorId,
      actor_role: 'executor',
      action: 'qr_scanned',
      from_status: booking.status,
      to_status: booking.status,
      payload: {
        tables_remaining: booking.tables_remaining
      }
    });

    return {
      booking: await this.getBookingWithRelations(booking.id),
      tables_remaining: booking.tables_remaining
    };
  }

  static async getWeeklyCalendar(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00+05:00`);
    const end = new Date(`${endDate}T23:59:59.999+05:00`);

    // Получаем все комнаты
    const rooms = await MeetingRoom.findAll({
      where: { isActive: true },
      include: [
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name', 'city']
        }
      ]
    });

    // Получаем все бронирования за период
    const bookings = await MeetingRoomBooking.findAll({
      where: {
        start_time: {
          [Op.between]: [start, end]
        }
      },
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom'
        },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name', 'phone']
        }
      ]
    });

    // Генерируем дни недели
    const weekDays = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      weekDays.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Группируем по комнатам и дням
    const roomsData = rooms.map(room => {
      const roomBookings = bookings.filter(b => b.meeting_room_id === room.id);
      const days = weekDays.map(date => {
        const dayBookings = roomBookings.filter(b => {
          const bookingDate = b.start_time.toISOString().split('T')[0];
          return bookingDate === date && 
                 b.status !== 'cancelled' && 
                 b.status !== 'auto_cancelled';
        });

        // Вычисляем процент загрузки (примерно: считаем, что комната может быть забронирована 8 часов в день)
        const maxSlots = 8; // 8 часов в день
        const occupiedSlots = dayBookings.length;
        const occupancyPercentage = Math.min(100, Math.round((occupiedSlots / maxSlots) * 100));

        // Добавляем информацию о бронированиях с пользователями
        const bookingsInfo = dayBookings.map(b => ({
          id: b.id,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
          company_name: b.company_name,
          user: b.client ? {
            id: b.client.id,
            full_name: b.client.full_name,
            phone: b.client.phone
          } : null
        }));

        return {
          date,
          occupancy_percentage: occupancyPercentage,
          bookings: bookingsInfo
        };
      });

      return {
        room_id: room.id,
        room_name: room.name,
        office_name: room.office?.name || 'Офис',
        days
      };
    });

    return {
      start_date: startDate,
      end_date: endDate,
      rooms: roomsData
    };
  }

  /** Форматирует начало/конец брони в дату и время по Asia/Almaty (для уведомлений и отображения). */
  static formatBookingDateTimeRange(startTime, endTime) {
    const opts = { timeZone: BOOKING_TIMEZONE };
    const start = startTime instanceof Date ? startTime : new Date(startTime);
    const end = endTime instanceof Date ? endTime : new Date(endTime);
    const startDate = start.toLocaleDateString('ru-RU', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' });
    const startLabel = start.toLocaleTimeString('ru-RU', { ...opts, hour: '2-digit', minute: '2-digit' });
    const endLabel = end.toLocaleTimeString('ru-RU', { ...opts, hour: '2-digit', minute: '2-digit' });
    return { startDate, startLabel, endLabel };
  }

  static async notifyClientBookingCreated(booking) {
    try {
      const { startDate, startLabel, endLabel } = this.formatBookingDateTimeRange(booking.start_time, booking.end_time);
      const title = 'Бронирование комнаты создано';
      const companyLine = booking.company_name ? `\nКомпания: ${booking.company_name}` : '';
      const capacityValue = booking.meetingRoom?.capacity;
      const capacityLine =
        typeof capacityValue === 'number'
          ? `\nВместимость: до ${capacityValue} человек`
          : '';
      const content = `Комната ${booking.meetingRoom?.name || booking.meeting_room_id} успешно забронирована.`
        + `\nДата: ${startDate}\nВремя: ${startLabel} - ${endLabel}${capacityLine}${companyLine}`;

      // Создаем in-app уведомление
      const notification = await Notification.create({
        user_id: booking.client_id,
        title,
        content,
        is_read: false
      });

      await NotificationLogService.createNotificationLog({
        notificationId: notification.id,
        userId: booking.client_id,
        notificationType: 'meeting_room_booking_created',
        deliveryMethod: 'in_app',
        status: 'delivered'
      });

      // Отправляем push-уведомление через NotificationService
      try {
        const NotificationService = (await import('./notificationService.js')).default;
        const pushData = {
          type: 'meeting_room_booking_created',
          bookingId: booking.id?.toString() || '',
          timestamp: new Date().toISOString()
        };
        await NotificationService.sendPushNotification(
          booking.client_id,
          title,
          content,
          pushData,
          notification.id
        );
      } catch (pushError) {
        logger.error('Failed to send push notification for booking created', { 
          error: pushError.message, 
          bookingId: booking.id,
          userId: booking.client_id
        });
        // Не прерываем выполнение, если push не удался - in-app уведомление уже создано
      }

      // Отправляем email уведомление, если у пользователя включены email уведомления
      try {
        const client = await User.findByPk(booking.client_id);
        if (client?.email && client?.email_verified && client?.email_notifications) {
          const { sendMail } = await import('../utils/nodemailer/nodemailer.js');
          await sendMail(client.email, title, content);
          
          // Логируем успешную отправку email
          await NotificationLogService.createNotificationLog({
            notificationId: notification.id,
            userId: booking.client_id,
            notificationType: 'meeting_room_booking_created',
            deliveryMethod: 'email',
            status: 'delivered',
            recipientEmail: client.email
          });
        }
      } catch (emailError) {
        logger.error('Failed to send email notification for booking created', { 
          error: emailError.message, 
          bookingId: booking.id,
          userId: booking.client_id
        });
        // Не прерываем выполнение, если email не удался
      }
    } catch (error) {
      logger.error('Failed to send booking notification', { error: error.message, bookingId: booking.id });
    }
  }

  static async notifyClientBookingReminder(booking) {
    try {
      const { startDate, startLabel, endLabel } = this.formatBookingDateTimeRange(booking.start_time, booking.end_time);
      const title = 'Напоминание о бронировании';
      const content = `Напоминание: Ваше бронирование комнаты ${booking.meetingRoom?.name || booking.meeting_room_id} начинается через 15 минут.`
        + `\nДата: ${startDate}\nВремя: ${startLabel} - ${endLabel}`;

      // Создаем in-app уведомление
      const notification = await Notification.create({
        user_id: booking.client_id,
        title,
        content,
        is_read: false
      });

      await NotificationLogService.createNotificationLog({
        notificationId: notification.id,
        userId: booking.client_id,
        notificationType: 'meeting_room_booking_reminder',
        deliveryMethod: 'in_app',
        status: 'delivered'
      });

      // Отправляем push-уведомление через NotificationService
      try {
        const NotificationService = (await import('./notificationService.js')).default;
        const pushData = {
          type: 'meeting_room_booking_reminder',
          bookingId: booking.id?.toString() || '',
          timestamp: new Date().toISOString()
        };
        await NotificationService.sendPushNotification(
          booking.client_id,
          title,
          content,
          pushData,
          notification.id
        );
      } catch (pushError) {
        logger.error('Failed to send push notification for booking reminder', { 
          error: pushError.message, 
          bookingId: booking.id,
          userId: booking.client_id
        });
        // Не прерываем выполнение, если push не удался - in-app уведомление уже создано
      }

      // Отправляем email уведомление, если у пользователя включены email уведомления
      try {
        const client = await User.findByPk(booking.client_id);
        if (client?.email && client?.email_verified && client?.email_notifications) {
          const { sendMail } = await import('../utils/nodemailer/nodemailer.js');
          await sendMail(client.email, title, content);
          
          // Логируем успешную отправку email
          await NotificationLogService.createNotificationLog({
            notificationId: notification.id,
            userId: booking.client_id,
            notificationType: 'meeting_room_booking_reminder',
            deliveryMethod: 'email',
            status: 'delivered',
            recipientEmail: client.email
          });
        }
      } catch (emailError) {
        logger.error('Failed to send email notification for booking reminder', { 
          error: emailError.message, 
          bookingId: booking.id,
          userId: booking.client_id
        });
        // Не прерываем выполнение, если email не удался
      }
    } catch (error) {
      logger.error('Failed to send booking reminder notification', { error: error.message, bookingId: booking.id });
    }
  }

  static async startInProgressBookings() {
    const now = new Date();
    
    // Находим все бронирования, которые должны начаться (start_time уже наступило, но статус еще не in_progress)
    const bookingsToStart = await MeetingRoomBooking.findAll({
      where: {
        status: {
          [Op.in]: ['scheduled', 'confirmed']
        },
        start_time: {
          [Op.lte]: now
        },
        end_time: {
          [Op.gt]: now // Еще не закончились
        }
      },
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom',
          attributes: ['id', 'name', 'capacity']
        }
      ]
    });

    if (bookingsToStart.length === 0) {
      return { started: 0 };
    }

    const tx = await sequelize.transaction();
    let startedCount = 0;

    try {
      for (const booking of bookingsToStart) {
        const previousStatus = booking.status;
        
        // Обновляем статус на in_progress
        await booking.update({
          status: 'in_progress'
        }, { transaction: tx });

        // Логируем изменение статуса
        await MeetingRoomBookingLog.create({
          booking_id: booking.id,
          room_id: booking.meeting_room_id,
          office_id: booking.office_id,
          actor_id: null, // Система
          actor_role: 'system',
          action: 'auto_started',
          from_status: previousStatus,
          to_status: 'in_progress',
          payload: {
            reason: 'Booking start time has arrived',
            started_at: now.toISOString()
          }
        }, { transaction: tx });

        startedCount++;
      }

      await tx.commit();
      
      logger.info('Bookings started (in_progress)', {
        count: startedCount,
        bookingIds: bookingsToStart.map(b => b.id)
      });

      return { started: startedCount };
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async sendBookingReminders() {
    const now = new Date();
    const reminderTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 минут от текущего момента
    
    // Находим бронирования, которым нужно отправить напоминание:
    // - Статус scheduled или confirmed
    // - start_time примерно через 15 минут (с допуском ±2 минуты для cron задачи, которая может запускаться каждые 5 минут)
    // - reminder_sent_at = null (еще не отправляли)
    const bookingsForReminder = await MeetingRoomBooking.findAll({
      where: {
        status: {
          [Op.in]: ['scheduled', 'confirmed']
        },
        start_time: {
          [Op.between]: [
            new Date(reminderTime.getTime() - 2 * 60 * 1000), // -2 минуты
            new Date(reminderTime.getTime() + 2 * 60 * 1000)  // +2 минуты
          ]
        },
        reminder_sent_at: null
      },
      include: [
        {
          model: MeetingRoom,
          as: 'meetingRoom',
          attributes: ['id', 'name', 'capacity']
        },
        {
          model: User,
          as: 'client',
          attributes: ['id', 'full_name']
        }
      ]
    });

    if (bookingsForReminder.length === 0) {
      return { remindersSent: 0 };
    }

    let remindersSent = 0;

    try {
      for (const booking of bookingsForReminder) {
        // Отправляем уведомление
        await this.notifyClientBookingReminder(booking);
        
        // Обновляем reminder_sent_at
        await booking.update({
          reminder_sent_at: now
        });

        remindersSent++;
      }

      logger.info('Booking reminders sent', {
        count: remindersSent,
        bookingIds: bookingsForReminder.map(b => b.id)
      });

      return { remindersSent };
    } catch (error) {
      logger.error('Error sending booking reminders', { error: error.message });
      throw error;
    }
  }
}

export default MeetingRoomBookingService;

