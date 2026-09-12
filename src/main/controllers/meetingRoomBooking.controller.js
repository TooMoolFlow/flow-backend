import MeetingRoomBookingService from '../services/meetingRoomBooking.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/errors.js';

class MeetingRoomBookingController {
  static getAvailability = asyncHandler(async (req, res) => {
    const availability = await MeetingRoomBookingService.getAvailability({
      ...req.query
    });

    res.json(availability);
  });

  static getRoomDailyAvailability = asyncHandler(async (req, res) => {
    const slotMinutes = req.query.slot_minutes ? parseInt(req.query.slot_minutes) : undefined;
    const availability = await MeetingRoomBookingService.getRoomDailyAvailability(req.params.id, {
      date: req.query.date,
      slot_minutes: slotMinutes
    });

    res.json(availability);
  });

  static createBooking = asyncHandler(async (req, res) => {
    const booking = await MeetingRoomBookingService.createBooking(req.user.id, req.body);
    res.status(201).json(booking);
  });

  static rescheduleBooking = asyncHandler(async (req, res) => {
    const booking = await MeetingRoomBookingService.rescheduleBooking(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body
    );
    res.json(booking);
  });

  static cancelBooking = asyncHandler(async (req, res) => {
    const booking = await MeetingRoomBookingService.cancelBooking(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body?.reason || null
    );
    res.json(booking);
  });

  static confirmAttendance = asyncHandler(async (req, res) => {
    const booking = await MeetingRoomBookingService.confirmAttendance(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json(booking);
  });

  static getMyBookings = asyncHandler(async (req, res) => {
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * pageSize;
    const statusFilter = ['active', 'completed', 'cancelled'].includes(req.query.status)
      ? req.query.status
      : null;
    const result = await MeetingRoomBookingService.getMyBookings(req.user.id, {
      limit: pageSize,
      offset,
      statusFilter
    });
    res.json({
      data: result.data,
      total: result.total,
      page,
      pageSize,
      hasMore: result.hasMore
    });
  });

  static getIncomingBookings = asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const filters = {
      date: req.query.date || null,
      office_id: req.query.office_id ? parseInt(req.query.office_id) : null,
      status: req.query.status || null,
      limit,
      offset
    };

    const bookings = await MeetingRoomBookingService.getIncomingBookings(filters);
    res.json(bookings);
  });

  static getAllBookings = asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    const filters = {
      date: req.query.date || null,
      office_id: req.query.office_id ? parseInt(req.query.office_id) : null,
      status: req.query.status || null,
      limit,
      offset
    };

    const bookings = await MeetingRoomBookingService.getAllBookings(filters);
    res.json(bookings);
  });

  static getStatistics = asyncHandler(async (req, res) => {
    const statistics = await MeetingRoomBookingService.getStatistics();
    res.json(statistics);
  });

  static getDailyCalendar = asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date) {
      throw new BadRequestError('Date parameter is required');
    }
    const calendar = await MeetingRoomBookingService.getDailyCalendar(date);
    res.json(calendar);
  });

  static getWeeklyCalendar = asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      throw new BadRequestError('start_date and end_date parameters are required');
    }
    const calendar = await MeetingRoomBookingService.getWeeklyCalendar(start_date, end_date);
    res.json(calendar);
  });

  static scanQRCode = asyncHandler(async (req, res) => {
    const { bookingId } = req.body;
    if (!bookingId) {
      throw new BadRequestError('bookingId is required');
    }
    const result = await MeetingRoomBookingService.scanQRCode(bookingId, req.user.id);
    res.json(result);
  });

  static getBookingById = asyncHandler(async (req, res) => {
    const booking = await MeetingRoomBookingService.getBookingWithRelations(req.params.id);
    res.json(booking);
  });
}

export default MeetingRoomBookingController;

