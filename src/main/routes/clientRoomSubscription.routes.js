import { Router } from "express";
import ClientRoomSubscriptionController from "../controllers/clientRoomSubscription.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Endpoints для админа
router.post(
    "/",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    ClientRoomSubscriptionController.createSubscription
);

router.delete(
    "/:id",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    ClientRoomSubscriptionController.deleteSubscription
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    ClientRoomSubscriptionController.getAllSubscriptions
);

router.get(
    "/room/:meeting_room_id",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    ClientRoomSubscriptionController.getRoomSubscriptions
);

// Endpoint для клиента (получение своих подписок)
router.get(
    "/client/:client_id",
    authenticateToken,
    ClientRoomSubscriptionController.getClientSubscriptions
);

export default router;

