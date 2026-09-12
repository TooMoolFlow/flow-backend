import express from 'express';
import RatingLogController from '../controllers/ratingLog.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateToken);

// Проверить структуру базы данных
router.get('/check-db', RatingLogController.checkDatabaseStructure);

// Тестовый эндпоинт для проверки работы логов
router.get('/test', RatingLogController.testRatingLog);

// Получить логи оценок по типу (client_rating, request_rating, executor_rating)
router.get('/type/:ratingType', RatingLogController.getRatingLogsByType);

// Получить логи оценок по ID рейтинга
router.get('/rating/:ratingType/:ratingId', RatingLogController.getRatingLogsByRatingId);

// Получить логи оценок по пользователю
router.get('/user/:userId', RatingLogController.getRatingLogsByUser);

// Получить статистику по логам оценок
router.get('/statistics', RatingLogController.getRatingLogsStatistics);

export default router;
