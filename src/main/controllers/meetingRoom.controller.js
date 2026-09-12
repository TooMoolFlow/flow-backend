import MeetingRoomService from "../services/meetingRoom.service.js";
import MeetingRoomPhotoService from "../services/meetingRoomPhoto.service.js";
import { asyncHandler } from "../middleware/asyncHandler.middleware.js";

class MeetingRoomController {
  static getAllMeetingRooms = asyncHandler(async (req, res) => {
    const officeId = req.query.office_id ? parseInt(req.query.office_id) : null;
    const rooms = await MeetingRoomService.getAllMeetingRooms(officeId);
    res.json(rooms);
  });

  static getMeetingRoomById = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const room = await MeetingRoomService.getMeetingRoomById(id);
    res.json(room);
  });

  static createMeetingRoom = asyncHandler(async (req, res) => {
    const newRoom = await MeetingRoomService.createMeetingRoom(req.body);
    res.status(201).json(newRoom);
  });

  static updateMeetingRoom = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const updatedRoom = await MeetingRoomService.updateMeetingRoom(id, req.body);
    res.json(updatedRoom);
  });

  static deleteMeetingRoom = asyncHandler(async (req, res) => {
    const id = req.params.id;
    await MeetingRoomService.deleteMeetingRoom(id);
    res.status(204).send();
  });

  static toggleMeetingRoomActive = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const room = await MeetingRoomService.toggleMeetingRoomActive(id);
    res.json(room);
  });

  static updateMeetingRoomStatus = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const room = await MeetingRoomService.updateMeetingRoomStatus(id, status);
    res.json(room);
  });

  static duplicateMeetingRoom = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const newRoom = await MeetingRoomService.duplicateMeetingRoom(id);
    res.status(201).json(newRoom);
  });

  static uploadRoomPhotos = asyncHandler(async (req, res) => {
    const roomId = parseInt(req.params.id, 10);
    const files = req.files || [];
    const photos = await MeetingRoomPhotoService.addPhotos(roomId, files);
    res.status(201).json({ photos });
  });

  static deleteRoomPhoto = asyncHandler(async (req, res) => {
    const roomId = parseInt(req.params.id, 10);
    const photoId = parseInt(req.params.photoId, 10);
    await MeetingRoomPhotoService.deletePhoto(roomId, photoId);
    res.status(204).send();
  });
}

export default MeetingRoomController;

