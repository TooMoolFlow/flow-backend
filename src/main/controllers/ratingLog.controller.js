import RatingLogService from '../services/ratingLog.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';

class RatingLogController {

    static checkDatabaseStructure = asyncHandler(async (req, res) => {
        const result = await RatingLogService.checkDatabaseStructure();
        res.json(result);
    });

    /**
     * Тестовый эндпоинт для проверки работы логов
     */
    static testRatingLog = asyncHandler(async (req, res) => {
        const testLog = await RatingLogService.createRatingLog({
            ratingType: 'client_rating',
            ratingId: 999,
            userId: req.user.id,
            actionType: 'created',
            actionDescription: 'Тестовый лог для проверки работы системы',
            newValues: { rating: 5, comment: 'Тест' }
        });
        res.json({ success: true, message: 'Тестовый лог создан успешно', log: testLog });
    });

    /**
     * Получить логи оценок по типу
     */
    static getRatingLogsByType = asyncHandler(async (req, res) => {
        const { ratingType } = req.params;
        const { page = 1, pageSize = 20, actionType, userId } = req.query;

        const result = await RatingLogService.getRatingLogsByType(ratingType, {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            actionType,
            userId: userId ? parseInt(userId) : null
        });

        res.json({
            success: true,
            data: result
        });
    });

    /**
     * Получить логи оценок по ID рейтинга
     */
    static getRatingLogsByRatingId = asyncHandler(async (req, res) => {
        const { ratingType, ratingId } = req.params;

        const logs = await RatingLogService.getRatingLogsByRatingId(ratingType, parseInt(ratingId));

        res.json({
            success: true,
            data: logs
        });
    });

    /**
     * Получить логи оценок по пользователю
     */
    static getRatingLogsByUser = asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { page = 1, pageSize = 20, ratingType } = req.query;

        const result = await RatingLogService.getRatingLogsByUser(parseInt(userId), {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            ratingType
        });

        res.json({
            success: true,
            data: result
        });
    });

    /**
     * Получить статистику по логам оценок
     */
    static getRatingLogsStatistics = asyncHandler(async (req, res) => {
        const { ratingType, startDate, endDate } = req.query;

        const statistics = await RatingLogService.getRatingLogsStatistics(
            ratingType,
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null
        );

        res.json({
            success: true,
            data: statistics
        });
    });
}

export default RatingLogController;
