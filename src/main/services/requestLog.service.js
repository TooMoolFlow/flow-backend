import { RequestLog, User, RequestGroup } from '../models/init.model.js';
import { Op } from 'sequelize';

class RequestLogService {
    /**
     * Создает новую запись в логе
     * ip_address обрезается до 45 символов (ограничение БД varchar(45))
     */
    static async createLog(logData, options = {}) {
        if (logData.ip_address != null && String(logData.ip_address).length > 45) {
            logData = { ...logData, ip_address: String(logData.ip_address).substring(0, 45) };
        }
        return await RequestLog.create(logData, options);
    }

    /**
     * Получает логи для конкретной группы заявок
     */
    static async getLogsByRequestId(requestGroupId, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await RequestLog.findAndCountAll({
            where: { request_id: requestGroupId },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: RequestGroup,
                    as: 'request',
                    attributes: ['id', 'location', 'status', 'request_type']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        return {
            logs: rows,
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize)
        };
    }

    /**
     * Получает логи для конкретного пользователя
     */
    static async getLogsByUserId(userId, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await RequestLog.findAndCountAll({
            where: { user_id: userId },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: RequestGroup,
                    as: 'request',
                    attributes: ['id', 'location', 'status', 'request_type']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        return {
            logs: rows,
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize)
        };
    }

    /**
     * Получает логи по типу действия
     */
    static async getLogsByActionType(actionType, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await RequestLog.findAndCountAll({
            where: { action_type: actionType },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: RequestGroup,
                    as: 'request',
                    attributes: ['id', 'location', 'status', 'request_type']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        return {
            logs: rows,
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize)
        };
    }

    /**
     * Получает логи за определенный период
     */
    static async getLogsByDateRange(startDate, endDate, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await RequestLog.findAndCountAll({
            where: {
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: RequestGroup,
                    as: 'request',
                    attributes: ['id', 'location', 'status', 'request_type']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        return {
            logs: rows,
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize)
        };
    }

    /**
     * Получает статистику по логам
     */
    static async getLogStatistics() {
        const totalLogs = await RequestLog.count();
        
        const actionTypeStats = await RequestLog.findAll({
            attributes: [
                'action_type',
                [RequestLog.sequelize.fn('COUNT', RequestLog.sequelize.col('id')), 'count']
            ],
            group: ['action_type'],
            order: [[RequestLog.sequelize.fn('COUNT', RequestLog.sequelize.col('id')), 'DESC']]
        });

        const todayLogs = await RequestLog.count({
            where: {
                created_at: {
                    [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });

        const thisWeekLogs = await RequestLog.count({
            where: {
                created_at: {
                    [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 7))
                }
            }
        });

        return {
            totalLogs,
            todayLogs,
            thisWeekLogs,
            actionTypeStats: actionTypeStats.map(stat => ({
                action_type: stat.action_type,
                count: parseInt(stat.dataValues.count)
            }))
        };
    }

    /**
     * Получает последние логи (для дашборда)
     */
    static async getRecentLogs(limit = 10) {
        return await RequestLog.findAll({
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: RequestGroup,
                    as: 'request',
                    attributes: ['id', 'location', 'status', 'request_type']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: limit
        });
    }

    /**
     * Удаляет старые логи (для очистки)
     */
    static async deleteOldLogs(daysOld = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const deletedCount = await RequestLog.destroy({
            where: {
                created_at: {
                    [Op.lt]: cutoffDate
                }
            }
        });

        return deletedCount;
    }

    /**
     * Получает логи с фильтрами
     */
    static async getLogsWithFilters(filters = {}, page = 1, pageSize = 20) {
        const offset = (page - 1) * pageSize;
        const whereClause = {};

        // Применяем фильтры
        if (filters.request_id) {
            whereClause.request_id = filters.request_id;
        }
        if (filters.user_id) {
            whereClause.user_id = filters.user_id;
        }
        if (filters.action_type) {
            whereClause.action_type = filters.action_type;
        }
        if (filters.start_date && filters.end_date) {
            whereClause.created_at = {
                [Op.between]: [filters.start_date, filters.end_date]
            };
        }

        const { count, rows } = await RequestLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: RequestGroup,
                    as: 'request',
                    attributes: ['id', 'location', 'status', 'request_type']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        return {
            logs: rows,
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize)
        };
    }
}

export default RequestLogService;
