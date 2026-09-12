import { Router } from "express"
import NotificationController from "../controllers/notification.controller.js"
import { authenticateToken } from "../middleware/auth.middleware.js"

const router = Router()

router.get("/me", authenticateToken, NotificationController.getMyNotifications)
router.patch("/:id/read", authenticateToken, NotificationController.markAsRead)
router.delete("/:id", authenticateToken, NotificationController.deleteNotification)
router.post(
    "/reject-assigned",
    authenticateToken,
    NotificationController.handleRejectAssignedRequest
);
router.post(
    "/health",
    authenticateToken,
    NotificationController.createHealthNotification
);

export default router
