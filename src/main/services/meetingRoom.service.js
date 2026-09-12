import { MeetingRoom } from "../models/meetingRoom.model.js";
import { Office, MeetingRoomPhoto } from "../models/init.model.js";
import { BadRequestError, NotFoundError } from '../errors/errors.js';

const roomInclude = [
  { model: Office, as: 'office', attributes: ['id', 'name', 'city'] },
  { model: MeetingRoomPhoto, as: 'roomPhotos', attributes: ['id', 'photo_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] },
];

function formatRoomPhotos(room) {
  const plain = room.toJSON ? room.toJSON() : room;
  if (plain.roomPhotos && plain.roomPhotos.length) {
    plain.photos = plain.roomPhotos.map((p) => p.photo_url);
  } else if (!plain.photos || !Array.isArray(plain.photos)) {
    plain.photos = [];
  }
  return plain;
}

class MeetingRoomService {
  static async getAllMeetingRooms(officeId = null) {
    const where = {};
    if (officeId) {
      where.office_id = officeId;
    }

    const rooms = await MeetingRoom.findAll({
      where,
      include: roomInclude,
      order: [['floor', 'ASC'], ['name', 'ASC']],
    });
    return rooms.map(formatRoomPhotos);
  }

  static async getRoomsByOfficeId(officeId) {
    const rooms = await MeetingRoom.findAll({
      where: { office_id: officeId, isActive: true },
      include: roomInclude,
      order: [['floor', 'ASC'], ['name', 'ASC']],
    });
    return rooms.map(formatRoomPhotos);
  }

  static async getMeetingRoomById(id) {
    const room = await MeetingRoom.findByPk(id, {
      include: roomInclude,
    });
    if (!room) {
      throw new NotFoundError(`Meeting room with id ${id} not found`);
    }
    return formatRoomPhotos(room);
  }

  static async createMeetingRoom(roomData) {
    return await MeetingRoom.create(roomData);
  }

  static async updateMeetingRoom(id, updateData) {
    const room = await MeetingRoom.findByPk(id);
    if (!room) {
      throw new NotFoundError(`Meeting room with id ${id} not found`);
    }
    
    await MeetingRoom.update(updateData, {
      where: { id: id }
    });
    const updated = await MeetingRoom.findByPk(id, { include: roomInclude });
    return formatRoomPhotos(updated);
  }

  static async deleteMeetingRoom(id) {
    const room = await MeetingRoom.findByPk(id);
    if (!room) {
      throw new NotFoundError(`Meeting room with id ${id} not found`);
    }
    
    return await MeetingRoom.destroy({
      where: { id: id }
    });
  }

  static async toggleMeetingRoomActive(id) {
    const room = await MeetingRoom.findByPk(id);
    if (!room) {
      throw new NotFoundError(`Meeting room with id ${id} not found`);
    }
    
    await MeetingRoom.update(
      { isActive: !room.isActive },
      { where: { id: id } }
    );
    const updated = await MeetingRoom.findByPk(id, { include: roomInclude });
    return formatRoomPhotos(updated);
  }

  static async updateMeetingRoomStatus(id, status) {
    const room = await MeetingRoom.findByPk(id);
    if (!room) {
      throw new NotFoundError(`Meeting room with id ${id} not found`);
    }
    
    if (!['available', 'booked'].includes(status)) {
      throw new BadRequestError('Invalid status. Must be "available" or "booked"');
    }
    
    await MeetingRoom.update(
      { status },
      { where: { id: id } }
    );
    const updated = await MeetingRoom.findByPk(id, { include: roomInclude });
    return formatRoomPhotos(updated);
  }

  static async duplicateMeetingRoom(id) {
    const original = await MeetingRoom.findByPk(id, { include: [{ model: MeetingRoomPhoto, as: 'roomPhotos' }] });
    if (!original) {
      throw new NotFoundError(`Meeting room with id ${id} not found`);
    }

    const roomData = {
      name: `${original.name} (копия)`,
      floor: original.floor,
      capacity: original.capacity,
      room_type: original.room_type || 'meeting',
      equipment: [...(original.equipment || [])],
      status: 'available',
      isActive: false,
      description: original.description || null,
      office_id: original.office_id
    };

    const newRoom = await MeetingRoom.create(roomData);
    const roomPhotos = original.roomPhotos || [];
    for (let i = 0; i < roomPhotos.length; i++) {
      await MeetingRoomPhoto.create({
        meeting_room_id: newRoom.id,
        photo_url: roomPhotos[i].photo_url,
        sort_order: i,
      });
    }
    return formatRoomPhotos(await MeetingRoom.findByPk(newRoom.id, { include: roomInclude }));
  }
}

export default MeetingRoomService;

