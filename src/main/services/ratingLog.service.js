import { RatingLog } from '../models/init.model.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.config.js';

class RatingLogService {

    /**
     * Проверяет наличие и структуру таблицы rating_logs в БД.
     */
    static async checkDatabaseStructure() {
        const [results] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'rating_logs'
        `);
        const tableExists = results.length > 0;
        if (!tableExists) {
            return { success: false, tableExists: false, message: 'Таблица rating_logs не найдена' };
        }
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'rating_logs'
            ORDER BY ordinal_position
        `);
        return { success: true, tableExists: true, columns };
    }

    /**
     * Создает лог для оценки/рейтинга
     * @param {Object} params - Параметры лога
     * @param {string} params.ratingType - Тип рейтинга (client_rating, request_rating)
     * @param {number} params.ratingId - ID рейтинга
     * @param {number} params.userId - ID пользователя, который выполнил действие
     * @param {string} params.actionType - Тип действия (created, updated, deleted)
     * @param {string} params.actionDescription - Описание действия
     * @param {Object} params.oldValues - Предыдущие значения (для update/delete)
     * @param {Object} params.newValues - Новые значения (для create/update)
     */
    static async createRatingLog({
        ratingType,
        ratingId,
        userId,
        actionType,
        actionDescription,
        oldValues = null,
        newValues = null
    }) {
        try {
            console.log('📝 Создание лога рейтинга:', {
                ratingType,
                ratingId,
                userId,
                actionType,
                actionDescription
            });
            
            const log = await RatingLog.create({
                rating_type: ratingType,
                rating_id: ratingId,
                user_id: userId,
                action_type: actionType,
                action_description: actionDescription,
                old_values: oldValues,
                new_values: newValues
            });
            
            console.log('✅ Лог рейтинга создан с ID:', log.id);
            return log;
        } catch (error) {
            console.error('❌ Error creating rating log:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                sql: error.sql
            });
            throw error;
        }
    }

    /**
     * Получает логи оценок по типу рейтинга
     * @param {string} ratingType - Тип рейтинга
     * @param {Object} options - Опции запроса
     * @param {number} options.page - Номер страницы
     * @param {number} options.pageSize - Размер страницы
     * @param {string} options.actionType - Фильтр по типу действия
     * @param {number} options.userId - Фильтр по пользователю
     */
    static async getRatingLogsByType(ratingType, options = {}) {
        const {
            page = 1,
            pageSize = 20,
            actionType = null,
            userId = null
        } = options;

        const offset = (page - 1) * pageSize;
        const where = { rating_type: ratingType };

        if (actionType) where.action_type = actionType;
        if (userId) where.user_id = userId;

        const { count, rows } = await RatingLog.findAndCountAll({
            where,
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
     * Получает логи оценок по ID рейтинга
     * @param {string} ratingType - Тип рейтинга
     * @param {number} ratingId - ID рейтинга
     */
    static async getRatingLogsByRatingId(ratingType, ratingId) {
        return await RatingLog.findAll({
            where: {
                rating_type: ratingType,
                rating_id: ratingId
            },
            order: [['created_at', 'DESC']]
        });
    }

    /**
     * Получает логи оценок по пользователю
     * @param {number} userId - ID пользователя
     * @param {Object} options - Опции запроса
     */
    static async getRatingLogsByUser(userId, options = {}) {
        const {
            page = 1,
            pageSize = 20,
            ratingType = null
        } = options;

        const offset = (page - 1) * pageSize;
        const where = { user_id: userId };

        if (ratingType) where.rating_type = ratingType;

        const { count, rows } = await RatingLog.findAndCountAll({
            where,
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
     * Получает статистику по логам оценок
     * @param {string} ratingType - Тип рейтинга (опционально)
     * @param {Date} startDate - Начальная дата
     * @param {Date} endDate - Конечная дата
     */
    static async getRatingLogsStatistics(ratingType = null, startDate = null, endDate = null) {
        const where = {};
        
        if (ratingType) where.rating_type = ratingType;
        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at[Op.gte] = startDate;
            if (endDate) where.created_at[Op.lte] = endDate;
        }

        const [totalLogs, actionTypeStats] = await Promise.all([
            RatingLog.count({ where }),
            RatingLog.findAll({
                where,
                attributes: [
                    'action_type',
                    [RatingLog.sequelize.fn('COUNT', RatingLog.sequelize.col('id')), 'count']
                ],
                group: ['action_type'],
                raw: true
            })
        ]);

        return {
            totalLogs,
            actionTypeStats: actionTypeStats.reduce((acc, stat) => {
                acc[stat.action_type] = parseInt(stat.count);
                return acc;
            }, {})
        };
    }
}

export default RatingLogService;
