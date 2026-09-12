import express from 'express';
import NotificationLogController from '../controllers/notificationLog.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// Получить логи уведомлений по статусу (sent, delivered, failed, pending)
router.get('/status/:status', NotificationLogController.getNotificationLogsByStatus);

// Получить логи уведомлений по пользователю
router.get('/user/:userId', NotificationLogController.getNotificationLogsByUser);

// Получить логи уведомлений по ID уведомления
router.get('/notification/:notificationId', NotificationLogController.getNotificationLogsByNotificationId);

// Получить статистику по логам уведомлений
router.get('/statistics', NotificationLogController.getNotificationLogsStatistics);

// Получить неудачные уведомления для повторной отправки
router.get('/failed', NotificationLogController.getFailedNotifications);

// Очистить старые логи уведомлений
router.delete('/cleanup', NotificationLogController.cleanupOldLogs);

export default router;
