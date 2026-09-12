import { Router } from "express";
import RequestLogController from "../controllers/requestLog.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Получение логов для конкретной заявки
router.get(
    "/request/:id",
    authenticateToken,
    RequestLogController.getLogsByRequestId
);

// Получение логов текущего пользователя
router.get(
    "/my",
    authenticateToken,
    RequestLogController.getMyLogs
);

// Получение логов по типу действия
router.get(
    "/action/:actionType",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "manager"),
    RequestLogController.getLogsByActionType
);

// Получение логов за период
router.get(
    "/date-range",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "manager"),
    RequestLogController.getLogsByDateRange
);

// Получение статистики по логам
router.get(
    "/statistics",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "manager"),
    RequestLogController.getLogStatistics
);

// Получение последних логов (для дашборда)
router.get(
    "/recent",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "manager"),
    RequestLogController.getRecentLogs
);

// Получение логов с фильтрами
router.get(
    "/filtered",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "manager"),
    RequestLogController.getLogsWithFilters
);

// Удаление старых логов (только для администраторов)
router.delete(
    "/old",
    authenticateToken,
    authorizeRoles("manager"),
    RequestLogController.deleteOldLogs
);

// Получение логов для конкретного пользователя (для администраторов)
router.get(
    "/user/:id",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "manager"),
    RequestLogController.getLogsByUserId
);

export default router;
