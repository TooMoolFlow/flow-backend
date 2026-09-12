import express from 'express';
import fcmController from '../controllers/fcm.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Публичный endpoint для получения VAPID ключа (нужен до аутентификации для регистрации Service Worker)
router.get('/vapid-key', fcmController.getVAPIDKey);

// Маршруты, требующие аутентификации
router.use(authenticateToken);

// Сохранение и управление токенами
router.post('/token', fcmController.saveToken);
router.delete('/token', fcmController.deleteToken);
router.get('/tokens', fcmController.getUserTokens);

// Отправка уведомлений
router.post('/send/user', fcmController.sendToUser);
router.post('/send/token', fcmController.sendToToken);
router.post('/send/topic', fcmController.sendToTopic);
router.post('/send/multicast', fcmController.sendMulticast);

// Управление темами
router.post('/subscribe', fcmController.subscribeToTopic);
router.post('/unsubscribe', fcmController.unsubscribeFromTopic);

// Статистика и тестирование
router.get('/stats', fcmController.getTokenStats);
router.post('/test', fcmController.sendTestNotification);

// Валидация и очистка токенов
router.post('/validate', fcmController.validateToken);
router.post('/cleanup', fcmController.cleanupInvalidTokens);

export default router;
