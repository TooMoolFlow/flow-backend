import { Router } from "express";
import MeetingRoomController from "../controllers/meetingRoom.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js";
import { commonUpload } from "../utils/multerUpload.js";

const router = Router();

router.get("/", MeetingRoomController.getAllMeetingRooms);
router.get("/:id", MeetingRoomController.getMeetingRoomById);
router.post(
  "/",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  MeetingRoomController.createMeetingRoom
);
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  MeetingRoomController.updateMeetingRoom
);
router.post(
  "/:id/photos",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  commonUpload.array("photos", 10),
  MeetingRoomController.uploadRoomPhotos
);
router.delete(
  "/:id/photos/:photoId",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  MeetingRoomController.deleteRoomPhoto
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  MeetingRoomController.deleteMeetingRoom
);
router.patch(
  "/:id/toggle-active",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  MeetingRoomController.toggleMeetingRoomActive
);
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("manager", "admin-worker", "department-head"),
  MeetingRoomController.updateMeetingRoomStatus
);
router.post(
  "/:id/duplicate",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  MeetingRoomController.duplicateMeetingRoom
);

export default router;

