import { Router } from "express";
import MeetingRoomBookingController from "../controllers/meetingRoomBooking.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/availability",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head", "admin-worker", "manager"),
  MeetingRoomBookingController.getAvailability
);

router.get(
  "/rooms/:id/availability",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head", "admin-worker", "manager"),
  MeetingRoomBookingController.getRoomDailyAvailability
);

router.get(
  "/incoming",
  authenticateToken,
  authorizeRoles("admin-worker", "manager"),
  MeetingRoomBookingController.getIncomingBookings
);

router.get(
  "/my",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head","admin-worker", "manager"),
  MeetingRoomBookingController.getMyBookings
);

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin-worker", "manager"),
  MeetingRoomBookingController.getAllBookings
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head","admin-worker", "manager"),
  MeetingRoomBookingController.createBooking
);

router.patch(
  "/:id/reschedule",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head", "admin-worker", "manager"),
  MeetingRoomBookingController.rescheduleBooking
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head", "admin-worker"),
  MeetingRoomBookingController.cancelBooking
);

router.post(
  "/:id/confirm-attendance",
  authenticateToken,
  authorizeRoles("client", "executor", "department-head","admin-worker", "manager"),
  MeetingRoomBookingController.confirmAttendance
);

router.get(
  "/statistics",
  authenticateToken,
  authorizeRoles("client", "admin-worker", "manager", "department-head"),
  MeetingRoomBookingController.getStatistics
);

router.get(
  "/calendar/daily",
  authenticateToken,
  authorizeRoles("client", "admin-worker", "manager", "department-head"),
  MeetingRoomBookingController.getDailyCalendar
);

router.get(
  "/calendar/weekly",
  authenticateToken,
  authorizeRoles("client", "admin-worker", "manager", "department-head"),
  MeetingRoomBookingController.getWeeklyCalendar
);

router.post(
  "/scan-qr",
  authenticateToken,
  authorizeRoles("executor"),
  MeetingRoomBookingController.scanQRCode
);

// Публичный endpoint для получения бронирования (для QR кода)
router.get(
  "/:id/public",
  MeetingRoomBookingController.getBookingById
);

export default router;

