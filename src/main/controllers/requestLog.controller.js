import RequestLogService from '../services/requestLog.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { validateId } from '../middleware/validate.middleware.js';
import { BadRequestError } from '../errors/errors.js';

class RequestLogController {
    /**
     * Получает логи для конкретной заявки
     */
    static getLogsByRequestId = asyncHandler(async (req, res) => {
        const requestId = validateId(req);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        const result = await RequestLogService.getLogsByRequestId(requestId, page, pageSize);
        res.json(result);
    });

    /**
     * Получает логи для текущего пользователя
     */
    static getMyLogs = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        const result = await RequestLogService.getLogsByUserId(userId, page, pageSize);
        res.json(result);
    });

    /**
     * Получает логи по типу действия
     */
    static getLogsByActionType = asyncHandler(async (req, res) => {
        const actionType = req.params.actionType;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        const result = await RequestLogService.getLogsByActionType(actionType, page, pageSize);
        res.json(result);
    });

    /**
     * Получает логи за определенный период
     */
    static getLogsByDateRange = asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        if (!startDate || !endDate) {
            throw new BadRequestError('startDate and endDate are required');
        }

        const result = await RequestLogService.getLogsByDateRange(
            new Date(startDate), 
            new Date(endDate), 
            page, 
            pageSize
        );
        res.json(result);
    });

    /**
     * Получает статистику по логам
     */
    static getLogStatistics = asyncHandler(async (req, res) => {
        const statistics = await RequestLogService.getLogStatistics();
        res.json(statistics);
    });

    /**
     * Получает последние логи (для дашборда)
     */
    static getRecentLogs = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const logs = await RequestLogService.getRecentLogs(limit);
        res.json(logs);
    });

    /**
     * Получает логи с фильтрами
     */
    static getLogsWithFilters = asyncHandler(async (req, res) => {
        const filters = req.query;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        // Удаляем параметры пагинации из фильтров
        delete filters.page;
        delete filters.pageSize;

        const result = await RequestLogService.getLogsWithFilters(filters, page, pageSize);
        res.json(result);
    });

    /**
     * Удаляет старые логи (только для администраторов)
     */
    static deleteOldLogs = asyncHandler(async (req, res) => {
        const daysOld = parseInt(req.query.daysOld) || 90;
        const deletedCount = await RequestLogService.deleteOldLogs(daysOld);
        
        res.json({ 
            message: `Deleted ${deletedCount} old log entries (older than ${daysOld} days)` 
        });
    });

    /**
     * Получает логи для конкретного пользователя (для администраторов)
     */
    static getLogsByUserId = asyncHandler(async (req, res) => {
        const userId = validateId(req);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;

        const result = await RequestLogService.getLogsByUserId(userId, page, pageSize);
        res.json(result);
    });
}

export default RequestLogController;
