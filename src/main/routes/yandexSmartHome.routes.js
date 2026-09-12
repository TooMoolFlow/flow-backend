import { Router } from "express";
import YandexSmartHomeController from "../controllers/yandexSmartHome.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Защищенные endpoints для админ панели
// saveTokens убран - токены сохраняются только через OAuth callback

router.get(
    "/tokens",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.getTokens
);

router.delete(
    "/tokens",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.deleteTokens
);

router.post(
    "/tokens/refresh",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.refreshTokens
);

// Управление устройствами для комнат
router.get(
    "/devices/list",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.getDevicesList
);

router.post(
    "/room-devices",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.createRoomDevice
);

router.get(
    "/room-devices",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.getAllRoomDevices
);

router.get(
    "/room-devices/room/:meeting_room_id",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.getRoomDevices
);

router.delete(
    "/room-devices/:id",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    YandexSmartHomeController.deleteRoomDevice
);

// Endpoints для клиентов (управление устройствами)
router.get(
    "/room-devices/room/:meeting_room_id/client",
    authenticateToken,
    YandexSmartHomeController.getRoomDevicesForClient
);

router.post(
    "/devices/control",
    authenticateToken,
    YandexSmartHomeController.controlDevice
);

export default router;

