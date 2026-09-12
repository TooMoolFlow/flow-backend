import { NotificationLog } from '../models/init.model.js';
import { Op } from 'sequelize';
import { NotFoundError } from '../errors/errors.js';
import logger from '../utils/winston/logger.js';

class NotificationLogService {
    /**
     * Создает лог для уведомления
     * @param {Object} params - Параметры лога
     * @param {number} params.notificationId - ID уведомления
     * @param {number} params.userId - ID пользователя
     * @param {string} params.notificationType - Тип уведомления
     * @param {string} params.deliveryMethod - Метод доставки (email, push, in_app)
     * @param {string} params.status - Статус доставки (sent, delivered, failed, pending)
     * @param {string} params.errorMessage - Сообщение об ошибке (если есть)
     * @param {string} params.recipientEmail - Email получателя
     * @param {string} params.fcmToken - FCM токен (для push уведомлений)
     */
    static async createNotificationLog({
        notificationId,
        userId,
        notificationType,
        deliveryMethod,
        status,
        errorMessage = null,
        recipientEmail = null,
        fcmToken = null
    }) {
        try {
            return await NotificationLog.create({
                notification_id: notificationId,
                user_id: userId,
                notification_type: notificationType,
                delivery_method: deliveryMethod,
                status: status,
                error_message: errorMessage,
                recipient_email: recipientEmail,
                fcm_token: fcmToken
            });
        } catch (error) {
            logger.error('Error creating notification log', { error: error?.message });
            throw error;
        }
    }

    /**
     * Обновляет статус лога уведомления
     * @param {number} logId - ID лога
     * @param {string} status - Новый статус
     * @param {string} errorMessage - Сообщение об ошибке (если есть)
     */
    static async updateNotificationLogStatus(logId, status, errorMessage = null) {
        try {
            const log = await NotificationLog.findByPk(logId);
            if (!log) {
                throw new NotFoundError('Notification log not found');
            }

            await log.update({
                status: status,
                error_message: errorMessage
            });

            return log;
        } catch (error) {
            logger.error('Error updating notification log status', { error: error?.message });
            throw error;
        }
    }

    /**
     * Получает логи уведомлений по статусу
     * @param {string} status - Статус уведомлений
     * @param {Object} options - Опции запроса
     */
    static async getNotificationLogsByStatus(status, options = {}) {
        const {
            page = 1,
            pageSize = 20,
            deliveryMethod = null,
            startDate = null,
            endDate = null
        } = options;

        const offset = (page - 1) * pageSize;
        const where = { status };

        if (deliveryMethod) where.delivery_method = deliveryMethod;
        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at[Op.gte] = startDate;
            if (endDate) where.created_at[Op.lte] = endDate;
        }

        const { count, rows } = await NotificationLog.findAndCountAll({
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
     * Получает логи уведомлений по пользователю
     * @param {number} userId - ID пользователя
     * @param {Object} options - Опции запроса
     */
    static async getNotificationLogsByUser(userId, options = {}) {
        const {
            page = 1,
            pageSize = 20,
            status = null,
            deliveryMethod = null
        } = options;

        const offset = (page - 1) * pageSize;
        const where = { user_id: userId };

        if (status) where.status = status;
        if (deliveryMethod) where.delivery_method = deliveryMethod;

        const { count, rows } = await NotificationLog.findAndCountAll({
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
     * Получает логи уведомлений по ID уведомления
     * @param {number} notificationId - ID уведомления
     */
    static async getNotificationLogsByNotificationId(notificationId) {
        return await NotificationLog.findAll({
            where: { notification_id: notificationId },
            order: [['created_at', 'DESC']]
        });
    }

    /**
     * Получает статистику по логам уведомлений
     * @param {Date} startDate - Начальная дата
     * @param {Date} endDate - Конечная дата
     */
    static async getNotificationLogsStatistics(startDate = null, endDate = null) {
        const where = {};
        
        if (startDate || endDate) {
            where.created_at = {};
            if (startDate) where.created_at[Op.gte] = startDate;
            if (endDate) where.created_at[Op.lte] = endDate;
        }

        const [totalLogs, statusStats, deliveryMethodStats] = await Promise.all([
            NotificationLog.count({ where }),
            NotificationLog.findAll({
                where,
                attributes: [
                    'status',
                    [NotificationLog.sequelize.fn('COUNT', NotificationLog.sequelize.col('id')), 'count']
                ],
                group: ['status'],
                raw: true
            }),
            NotificationLog.findAll({
                where,
                attributes: [
                    'delivery_method',
                    [NotificationLog.sequelize.fn('COUNT', NotificationLog.sequelize.col('id')), 'count']
                ],
                group: ['delivery_method'],
                raw: true
            })
        ]);

        return {
            totalLogs,
            statusStats: statusStats.reduce((acc, stat) => {
                acc[stat.status] = parseInt(stat.count);
                return acc;
            }, {}),
            deliveryMethodStats: deliveryMethodStats.reduce((acc, stat) => {
                acc[stat.delivery_method] = parseInt(stat.count);
                return acc;
            }, {})
        };
    }

    /**
     * Получает неудачные уведомления для повторной отправки
     * @param {number} limit - Лимит записей
     */
    static async getFailedNotifications(limit = 100) {
        return await NotificationLog.findAll({
            where: { status: 'failed' },
            order: [['created_at', 'ASC']],
            limit: limit
        });
    }

    /**
     * Очищает старые логи уведомлений
     * @param {number} daysToKeep - Количество дней для хранения логов
     */
    static async cleanupOldLogs(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const deletedCount = await NotificationLog.destroy({
            where: {
                created_at: {
                    [Op.lt]: cutoffDate
                }
            }
        });

        return deletedCount;
    }
}

export default NotificationLogService;
