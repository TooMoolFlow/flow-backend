import NotificationLogService from "../services/notificationLog.service.js";
import { asyncHandler } from "../middleware/asyncHandler.middleware.js";

class NotificationLogController {
    /**
     * Получить логи уведомлений по статусу
     */
    static getNotificationLogsByStatus = asyncHandler(async (req, res) => {
        const { status } = req.params;
        const { page = 1, pageSize = 20, deliveryMethod, startDate, endDate } = req.query;

        const result = await NotificationLogService.getNotificationLogsByStatus(status, {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            deliveryMethod,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null
        });

        res.json({
            success: true,
            data: result
        });
    });

    /**
     * Получить логи уведомлений по пользователю
     */
    static getNotificationLogsByUser = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { page = 1, pageSize = 20, status, deliveryMethod } = req.query;

        const result = await NotificationLogService.getNotificationLogsByUser(parseInt(userId), {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            status,
            deliveryMethod
        });

        res.json({
            success: true,
            data: result
        });
    });

    /**
     * Получить логи уведомлений по ID уведомления
     */
    static getNotificationLogsByNotificationId = asyncHandler(async (req, res) => {
        const { notificationId } = req.params;

        const logs = await NotificationLogService.getNotificationLogsByNotificationId(parseInt(notificationId));

        res.json({
            success: true,
            data: logs
        });
    });

    /**
     * Получить статистику по логам уведомлений
     */
    static getNotificationLogsStatistics = asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;

        const statistics = await NotificationLogService.getNotificationLogsStatistics(
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null
        );

        res.json({
            success: true,
            data: statistics
        });
    });

    /**
     * Получить неудачные уведомления для повторной отправки
     */
    static getFailedNotifications = asyncHandler(async (req, res) => {
        const { limit = 100 } = req.query;

        const failedNotifications = await NotificationLogService.getFailedNotifications(parseInt(limit));

        res.json({
            success: true,
            data: failedNotifications
        });
    });

    /**
     * Очистить старые логи уведомлений
     */
    static cleanupOldLogs = asyncHandler(async (req, res) => {
        const { daysToKeep = 90 } = req.query;

        const deletedCount = await NotificationLogService.cleanupOldLogs(parseInt(daysToKeep));

        res.json({
            success: true,
            message: `Удалено ${deletedCount} старых логов уведомлений`,
            deletedCount
        });
    });
}

export default NotificationLogController;
