import RequestLogService from '../services/requestLog.service.js';
import { RequestGroup, Request } from '../models/init.model.js';

/**
 * Утилита для логирования действий с заявками
 */
class RequestLogger {

    /**
     * Получает request_group_id для подзаявки или возвращает ID как есть, если это уже группа
     */
    static async getRequestGroupId(requestId) {
        try {
            // Сначала проверяем, существует ли группа с таким ID
            const group = await RequestGroup.findByPk(requestId);
            if (group) {
                return requestId; // Это уже ID группы
            }
            
            // Если нет, ищем подзаявку и получаем её group_id
            const request = await Request.findByPk(requestId);
            if (request && request.request_group_id) {
                return request.request_group_id;
            }
            
            return requestId; // Возвращаем как есть, если не найдено
        } catch (error) {
            console.error('Error getting request group ID:', error);
            return requestId;
        }
    }

    /**
     * Логирует создание группы заявок
     */
    static async logRequestCreated(requestGroupId, userId, requestGroupData, ipAddress = null, userAgent = null) {
        try {
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'created',
                action_description: `Создана новая группа заявок: "${requestGroupData.location}"`,
                new_values: {
                    location: requestGroupData.location,
                    location_detail: requestGroupData.location_detail,
                    status: requestGroupData.status,
                    request_type: requestGroupData.request_type
                },
                ip_address: ipAddress,
                user_agent: userAgent
            });
        } catch (error) {
            console.error('Error logging request group creation:', error);
        }
    }

    /**
     * Логирует обновление заявки
     */
    static async logRequestUpdated(requestId, userId, oldData, newData, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            const changes = this.getChanges(oldData, newData);
            if (Object.keys(changes).length === 0) return;

            const changeDescriptions = Object.entries(changes).map(([field, change]) => {
                return `${field}: "${change.old}" → "${change.new}"`;
            }).join(', ');

            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'updated',
                action_description: `Обновлена заявка: ${changeDescriptions}`,
                old_values: oldData,
                new_values: newData,
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging request update:', error);
        }
    }

    /**
     * Логирует изменение статуса заявки
     */
    static async logStatusChanged(requestId, userId, oldStatus, newStatus, reason = null, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            let description = `Статус изменен: ${oldStatus} → ${newStatus}`;
            if (reason) {
                description += ` (Причина: ${reason})`;
            }

            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'status_changed',
                action_description: description,
                old_values: { status: oldStatus },
                new_values: { status: newStatus, reason },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging status change:', error);
        }
    }

    /**
     * Логирует назначение исполнителя (новая версия с поддержкой множественных исполнителей)
     */
    static async logExecutorAssigned(requestId, userId, executorId, executorName, role = 'executor', ipAddress = null, userAgent = null) {
        try {
            // Получаем request_group_id для этой подзаявки
            const request = await Request.findByPk(requestId, {
                include: [{ model: RequestGroup, as: 'requestGroup' }]
            });

            await RequestLogService.createLog({
                request_id: request ? request.request_group_id : requestId,
                user_id: userId,
                action_type: 'assigned',
                action_description: `Назначен исполнитель: ${executorName} (роль: ${role}) для подзаявки ${requestId}`,
                new_values: { 
                    sub_request_id: requestId,
                    executor_id: executorId, 
                    executor_name: executorName,
                    role: role
                },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging executor assignment:', error);
        }
    }

    /**
     * Логирует начало выполнения заявки
     */
    static async logRequestStarted(requestId, userId, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'started',
                action_description: 'Начато выполнение заявки',
                new_values: { date_submitted: new Date() },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging request start:', error);
        }
    }

    /**
     * Логирует завершение заявки
     */
    static async logRequestCompleted(requestId, userId, comment = null, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            let description = 'Заявка завершена';
            if (comment) {
                description += ` (Комментарий: ${comment})`;
            }

            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'completed',
                action_description: description,
                new_values: { 
                    actual_completion_date: new Date(),
                    comment 
                },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging request completion:', error);
        }
    }

    /**
     * Логирует отклонение заявки
     */
    static async logRequestRejected(requestId, userId, reason, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'rejected',
                action_description: `Заявка отклонена: ${reason}`,
                new_values: { rejection_reason: reason },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging request rejection:', error);
        }
    }

    /**
     * Логирует добавление комментария
     */
    static async logCommentAdded(requestId, userId, comment, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'commented',
                action_description: `Добавлен комментарий: ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
                new_values: { comment },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging comment addition:', error);
        }
    }

    /**
     * Логирует добавление фото
     */
    static async logPhotoAdded(requestId, userId, photoType, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'photo_added',
                action_description: `Добавлено фото (${photoType})`,
                new_values: { photo_type: photoType },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging photo addition:', error);
        }
    }

    /**
     * Логирует изменение флага долгосрочной заявки
     */
    static async logLongTermToggled(requestId, userId, isLongTerm, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            const status = isLongTerm ? 'установлен' : 'снят';
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'long_term_toggled',
                action_description: `Флаг долгосрочной заявки ${status}`,
                new_values: { is_long_term: isLongTerm },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging long term toggle:', error);
        }
    }

    /**
     * Логирует возврат заявки на доработку
     */
    static async logRequestReturned(requestId, userId, reason, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'returned',
                action_description: `Заявка возвращена на доработку: ${reason}`,
                new_values: { return_reason: reason },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging request return:', error);
        }
    }

    /**
     * Логирует изменение приоритета
     */
    static async logPriorityChanged(requestId, userId, oldPriority, newPriority, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'priority_changed',
                action_description: `Приоритет изменен: ${oldPriority} → ${newPriority}`,
                old_values: { request_type: oldPriority },
                new_values: { request_type: newPriority },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging priority change:', error);
        }
    }

    /**
     * Логирует изменение категории
     */
    static async logCategoryChanged(requestId, userId, oldCategory, newCategory, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'category_changed',
                action_description: `Категория изменена: ${oldCategory} → ${newCategory}`,
                old_values: { category_id: oldCategory },
                new_values: { category_id: newCategory },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging category change:', error);
        }
    }

    /**
     * Логирует изменение местоположения
     */
    static async logLocationChanged(requestId, userId, oldLocation, newLocation, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'location_changed',
                action_description: `Местоположение изменено: "${oldLocation}" → "${newLocation}"`,
                old_values: { location: oldLocation },
                new_values: { location: newLocation },
                ip_address: ipAddress,
                user_agent: userAgent
            }, { validate: false }); // Bypass validation due to Sequelize bug
        } catch (error) {
            console.error('Error logging location change:', error);
        }
    }

    /**
     * Логирует удаление заявки
     */
    static async logRequestDeleted(requestId, userId, requestTitle, ipAddress = null, userAgent = null) {
        try {
            const requestGroupId = await this.getRequestGroupId(requestId);
            
            await RequestLogService.createLog({
                request_id: requestGroupId,
                user_id: userId,
                action_type: 'deleted',
                action_description: `Заявка удалена: "${requestTitle}"`,
                old_values: { title: requestTitle },
                ip_address: ipAddress,
                user_agent: userAgent
            });
        } catch (error) {
            console.error('Error logging request deletion:', error);
        }
    }

    /**
     * Получает изменения между старыми и новыми данными
     */
    static getChanges(oldData, newData) {
        const changes = {};
        const fieldsToTrack = ['title', 'description', 'location', 'location_detail', 'status', 'request_type', 'category_id', 'executor_id', 'complexity', 'sla', 'comment', 'is_long_term'];

        for (const field of fieldsToTrack) {
            if (oldData[field] !== newData[field]) {
                changes[field] = {
                    old: oldData[field],
                    new: newData[field]
                };
            }
        }

        return changes;
    }

    /**
     * Получает IP адрес из запроса
     */
    static getIpAddress(req) {
        return req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               null;
    }

    /**
     * Получает User-Agent из запроса
     */
    static getUserAgent(req) {
        return req.headers['user-agent'] || null;
    }
}

export default RequestLogger;
