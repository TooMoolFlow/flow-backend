import {Executor, Notification, User, RequestExecutor, Request, RequestGroup, Office} from "../models/init.model.js"
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import fcmService from "./fcm.service.js";
import NotificationLogService from "./notificationLog.service.js";
import { sendMail } from '../utils/nodemailer/nodemailer.js';
import logger from '../utils/winston/logger.js';
import { Op } from 'sequelize';

class NotificationService {
    static getCompleterRoleLabel(role) {
        switch (role) {
            case 'admin-worker':
                return 'Администратор офиса';
            case 'department-head':
                return 'Офис-менеджер';
            case 'executor':
                return 'Исполнитель';
            default:
                return 'Сотрудник';
        }
    }

    static async getEndRequestNotificationText({ completedByUserId, request, content }) {
        const requestGroupId =
            request?.requestGroup?.id ?? request?.request_group_id ?? request?.id;

        let roleLabel = 'Исполнитель';
        if (completedByUserId) {
            const completer = await User.findByPk(completedByUserId, {
                attributes: ['id', 'role'],
            });
            if (completer?.role) {
                roleLabel = NotificationService.getCompleterRoleLabel(completer.role);
            }
        }

        const title = `${roleLabel} завершил выполнение заявки`;
        if (typeof content === 'string' && content.length > 0) {
            return { title, content };
        }

        const baseContent = `${roleLabel} завершил выполнение заявки № ${requestGroupId}`;
        const notifContent =
            roleLabel === 'Исполнитель'
                ? `${baseContent}. Пожалуйста, оцените качество его работы.`
                : `${baseContent}.`;

        return { title, content: notifContent };
    }

    static async getNotificationsByUserId(userId, page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await Notification.findAndCountAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset,
        });

        return {
            notifications: rows,
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize),
        };
    }

    static async markAsRead(id, userId) {
        const notification = await Notification.findByPk(id)
        if (!notification) {
            throw new NotFoundError("Notification not found")
        }
        if (notification.user_id !== userId) {
            throw new ForbiddenError("Forbidden")
        }
        notification.is_read = true
        await notification.save()
        return notification
    }

    static async deleteNotification(id, userId) {
        const notification = await Notification.findByPk(id)
        if (!notification) {
            throw new NotFoundError("Notification not found")
        }
        if (notification.user_id !== userId) {
            throw new ForbiddenError("Forbidden")
        }
        return await Notification.destroy({where: {id}})
    }

    static async sendPasswordNotification({ userId, rawPassword }) {
        const user = await User.findByPk(userId);

        if (!user) {
            throw new NotFoundError('User not found');
        }

        const title = 'Добро пожаловать!';
        const content = `Ваш аккаунт был создан. Ваш пароль: ${rawPassword}`;

        // Сохраняем уведомление в БД
        const notification = await Notification.create({
            user_id: user.id,
            title,
            content,
            is_read: false
        });

        // Логируем in-app уведомление
        await NotificationLogService.createNotificationLog({
            notificationId: notification.id,
            userId: user.id,
            notificationType: 'password_notification',
            deliveryMethod: 'in_app',
            status: 'delivered'
        });

        try {
            // Отправляем email через nodemailer
            await sendMail(user.email, title, content);

            // Логируем успешную отправку email
            await NotificationLogService.createNotificationLog({
                notificationId: notification.id,
                userId: user.id,
                notificationType: 'password_notification',
                deliveryMethod: 'email',
                status: 'delivered',
                recipientEmail: user.email
            });
        } catch (error) {
            // Логируем неудачную отправку email
            await NotificationLogService.createNotificationLog({
                notificationId: notification.id,
                userId: user.id,
                notificationType: 'password_notification',
                deliveryMethod: 'email',
                status: 'failed',
                errorMessage: error.message,
                recipientEmail: user.email
            });
            throw error;
        }
    }

    static async sendNotification({ userId, request, type, content = null, req = null, completedByUserId = null }) {
        try {
            if (!userId || !type) {
                throw new BadRequestError("Missing required fields: userId or type");
            }

            const sender = await User.findByPk(userId);
            if (!sender) {
                throw new NotFoundError(`User with id ${userId} not found`);
            }

            // Для типов, где нужен request, валидируем заранее
            const needsRequest = new Set([
                "new_request",
                "awaiting_assignment",
                "assigned",
                "start_request",
                "end_request",
                "user_request_assigned"
            ]);
            if (needsRequest.has(type) && (!request || !request.id)) {
                throw new BadRequestError(`'request' with valid id is required for type '${type}'`);
            }

            let notifTitle;
            let notifContent;
            let recipients = [];

            switch (type) {
                case "new_request": {
                    
                    const admins = await User.findAll({
                        where: {
                            role: "admin-worker"
                        },
                    });
                    recipients = admins;
                    notifTitle = "Новая заявка";
                    notifContent = `${sender?.full_name ? sender?.full_name : "Пользователь из вашего офиса"} создал новую заявку № ${request?.id}`;
                    break;
                }

                case "reject_request": {
                    recipients = [sender];
                    notifTitle = `Заявка № ${request?.id ? request.id : null} отклонена`;
                    notifContent = content || "Ваша заявка была отклонена.";
                    break;
                }

                case "user_request_assigned": {
                    recipients = [sender];
                    notifTitle = `Вашей заявке назначен исполнитель`;
                    notifContent = `Вашей заявке № ${request.requestGroup.id} был назначен исполнитель.`;
                    break;
                }

                case "awaiting_assignment": {
                    // Руководители по категориям услуг из подзаявок + автор
                    const requestGroup = await RequestGroup.findByPk(request.id, {
                        include: [{
                            model: Request,
                            as: 'requests',
                            attributes: ['category_id']
                        }]
                    });
                    
                    const departmentHeads = await User.findAll({
                        where: {
                            role: "department-head",
                            office_id: requestGroup.office_id,
                        },
                    });
                    if (req.user.role === 'admin-worker') {
                        notifTitle = "Админ создал заявку";
                        notifContent = content || `Заявка № ${request.id} ожидает назначения.`;
                        recipients = [...departmentHeads];
                    } else {
                        notifTitle = "Админ принял заявку";
                        notifContent = content || `Заявка № ${request.id} принята администратором и ожидает назначения.`;
                        recipients = [...departmentHeads, sender];
                    }
                    break;
                }

                case "assigned": {
                    // Получаем всех исполнителей для всех подзаявок в группе
                    const assignedRequest = await Request.findByPk(request.id, {
                        include: [{
                            model: RequestExecutor,
                            as: 'requestExecutors',
                            include: [{
                                model: Executor,
                                as: 'executor',
                                include: [{
                                    model: User,
                                    as: 'user',
                                    attributes: ['id', 'full_name', 'phone', 'email', 'email_verified', 'email_notifications']
                                }]
                            }]
                        }]
                    });

                    // Собираем всех исполнителей из всех подзаявок
                    const allExecutors = [];
                    assignedRequest.requestExecutors.forEach(re => {
                        if (re.executor?.user) {
                            allExecutors.push(re.executor.user);
                        }
                    });

                    if (allExecutors.length === 0) {
                        throw new NotFoundError(`No executors found for request group ${request.id}`);
                    }

                    // Дедуплицируем исполнителей
                    const executorUsers = NotificationService._uniqueUsers(allExecutors);

                    recipients = executorUsers;
                    notifTitle = "Вам назначили новую заявку!";
                    notifContent = `Вам назначена заявка № ${request.requestGroup.id}`;
                    break;
                }

                case "start_request":
                case "end_request": {
                    // Получаем всех исполнителей для всех подзаявок в группе
                    const currentRequest = await Request.findByPk(request.id, {
                        include: [{
                            model: RequestExecutor,
                            as: 'requestExecutors',
                            include: [{
                                model: Executor,
                                as: 'executor',
                                include: [{
                                    model: User,
                                    as: 'user',
                                    attributes: ['id', 'full_name', 'phone', 'email', 'email_verified', 'email_notifications']
                                }]
                            }]
                        }]
                    });

                    // Собираем всех исполнителей из всех подзаявок
                    const allExecutors = [];
                    currentRequest.requestExecutors.forEach(re => {
                        if (re.executor?.user) {
                            allExecutors.push(re.executor.user);
                        }
                    });

                    // Админы офиса
                    const officeAdmins = await User.findAll({
                        where: {
                            role: "admin-worker"
                        },
                    });

                    const requestGroupForOffice = await RequestGroup.findByPk(request.request_group_id, {
                        attributes: ['office_id'],
                    });
                    const departmentHeads = requestGroupForOffice?.office_id
                        ? await User.findAll({
                            where: {
                                role: 'department-head',
                                office_id: requestGroupForOffice.office_id,
                            },
                        })
                        : [];

                    recipients = [
                        ...officeAdmins,
                        sender,
                        ...departmentHeads,
                    ];

                    if (type === "start_request") {
                        notifTitle = "Исполнитель начал исполнять заявку";
                        notifContent =
                            content ||
                            `Исполнитель приступил к выполнению заявки № ${request?.requestGroup?.id ?? request?.request_group_id ?? request?.id}`;
                    } else {
                        const endTexts = await NotificationService.getEndRequestNotificationText({
                            completedByUserId,
                            request,
                            content,
                        });
                        notifTitle = endTexts.title;
                        notifContent = endTexts.content;
                    }
                    break;
                }

                default:
                    throw new BadRequestError(`Unknown notification type: ${type}`);
            }

            // Дедупликация по user.id и фильтрация невалидных
            recipients = NotificationService._uniqueUsers(
                (recipients || []).filter((u) => !!u && !!u.id)
            );

            logger.debug('sendNotification: final recipients', { type, count: recipients.length, recipients: recipients.map(r => ({ id: r.id, role: r.role })) });

            if (recipients.length === 0) {
                // Не считаем это ошибкой: просто некому отправлять
                logger.debug('sendNotification: no recipients', { type });
                return;
            }

            // Создаём уведомления для всех получателей
            const notifPayloads = recipients.map((r) => ({
                user_id: r.id,
                title: notifTitle,
                content: notifContent,
                is_read: false,
            }));
            logger.debug('sendNotification: creating notifications', { count: notifPayloads.length });
            const createdNotifications = await Notification.bulkCreate(notifPayloads);
            
            // Логируем создание in-app уведомлений
            for (const notification of createdNotifications) {
                await NotificationLogService.createNotificationLog({
                    notificationId: notification.id,
                    userId: notification.user_id,
                    notificationType: type,
                    deliveryMethod: 'in_app',
                    status: 'delivered'
                });
            }

            const emailRecipients = recipients.filter((r) => 
                r.email && 
                r.email_verified && 
                r.email_notifications
            );
            logger.debug('sendNotification: sending emails', { count: emailRecipients.length });
            if (emailRecipients.length > 0) {
                await Promise.allSettled(
                    emailRecipients.map(async (r) => {
                        const notification = createdNotifications.find(n => n.user_id === r.id);
                        if (!notification) return;

                        try {
                            await sendMail(r.email, notifTitle, notifContent);

                            // Логируем успешную отправку email
                            await NotificationLogService.createNotificationLog({
                                notificationId: notification.id,
                                userId: r.id,
                                notificationType: type,
                                deliveryMethod: 'email',
                                status: 'delivered',
                                recipientEmail: r.email
                            });
                        } catch (error) {
                            // Логируем неудачную отправку email
                            await NotificationLogService.createNotificationLog({
                                notificationId: notification.id,
                                userId: r.id,
                                notificationType: type,
                                deliveryMethod: 'email',
                                status: 'failed',
                                errorMessage: error.message,
                                recipientEmail: r.email
                            });
                            throw error;
                        }
                    })
                );
            }

            // Отправляем push-уведомления всем получателям
            const pushData = {
                type: type,
                requestId: request?.id?.toString() || '',
                timestamp: new Date().toISOString()
            };

            logger.debug('sendNotification: sending push', { count: recipients.length });
            await Promise.allSettled(
                recipients.map(async (r) => {
                    const notification = createdNotifications.find(n => n.user_id === r.id);
                    return NotificationService.sendPushNotification(
                        r.id, 
                        notifTitle, 
                        notifContent, 
                        pushData,
                        notification?.id
                    );
                })
            );
        } catch (error) {
            logger.error('Error in sendNotification', { error: error?.message });
            throw error;
        }
    }

    static async sendNotificationToManagers(title, content) {
        const managers = await User.findAll({
            where: {
                role: 'manager'
            }
        });
        
        for (const manager of managers) {
            // Всегда сохраняем уведомление в БД
            await Notification.create({
                user_id: manager.id,
                title: title,
                content: content,
                is_read: false
            });
            
            // Отправляем email только если включены email уведомления и email верифицирован
            if (manager.email && manager.email_verified && manager.email_notifications) {
                await sendMail(manager.email, title, content);
            }

            // Отправляем push-уведомление
            const pushData = {
                type: 'manager_notification',
                timestamp: new Date().toISOString()
            };
            await NotificationService.sendPushNotification(manager.id, title, content, pushData);
        }
    }

    static async handleRejectAssignedRequest(requestId, reason, userId) {
        const executor = await Executor.findOne({
            where: {user_id: userId},
            include: [{model: User, as: 'user', attributes: ['full_name']}]
        });
        const user = await User.findByPk(executor.department_id);

        const title = 'Заявка возвращена исполнителем';
        const content = `Исполнитель ${executor.user.full_name} вернул заявку «${requestId}» на повторное назначение. Причина: ${reason}.`;

        const tasks = [
            this.saveNotification(user.id, title, content, user.id)
        ];
        // if (user.email_notifications) {
        //     tasks.push(this.sendEmailNotification(user.email, title, content),);
        // }

        // Добавляем push-уведомление
        const pushData = {
            type: 'request_rejected',
            requestId: requestId?.toString() || '',
            timestamp: new Date().toISOString()
        };
        tasks.push(this.sendPushNotification(user.id, title, content, pushData));

        const results = await Promise.allSettled(tasks);

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                logger.error('sendNotification task error', { index, reason: result.reason });
            }
        });
    }

    static async sendEmailNotification(email, title, content) {
        if (!email) {
            throw new BadRequestError("Email is required");
        }
        if (!title) {
            throw new BadRequestError("title is required");
        }
        if (!content) {
            throw new BadRequestError("content is required");
        }
        await sendMail(email, title, content);
    }

    static async saveNotification(user_id, title, content) {
        await Notification.create({ user_id, title, content, is_read: false });
    }

    // Добавляю метод для уведомления о новых запросах
    /**
     * Тестовый push «новая регистрация» одному пользователю (тот же payload, что у реального события).
     */
    static async sendTestNewRegistrationPushToUser(recipientUserId, officeId) {
        if (!recipientUserId || !officeId) {
            throw new BadRequestError('recipientUserId и officeId обязательны');
        }

        const office = await Office.findByPk(officeId);
        if (!office) {
            throw new NotFoundError('Офис не найден');
        }

        const recipient = await User.findByPk(recipientUserId);
        if (!recipient) {
            throw new NotFoundError('Пользователь не найден');
        }

        const title = 'Новый пользователь запрашивает доступ';
        const content = `Офис: ${office.name}`;
        const testRequestId = `test_${Date.now()}`;

        const notification = await Notification.create({
            user_id: recipientUserId,
            title: `[Тест] ${title}`,
            content,
            is_read: false,
        });

        await NotificationLogService.createNotificationLog({
            notificationId: notification.id,
            userId: recipientUserId,
            notificationType: 'new_registration_request_test',
            deliveryMethod: 'in_app',
            status: 'delivered',
        });

        const pushData = {
            type: 'new_registration_request',
            registration_request_id: String(testRequestId),
            office_id: String(officeId),
            office_name: office.name,
            timestamp: new Date().toISOString(),
        };

        await NotificationService.sendPushNotification(
            recipient.id,
            title,
            content,
            pushData,
            notification.id
        );

        return { recipientUserId: recipient.id, officeId };
    }

    /**
     * Push + in-app для администраторов офиса (admin-worker) при новой заявке на регистрацию.
     */
    static async notifyNewRegistrationRequest(requestData) {
        try {
            if (!requestData?.office_id) {
                logger.warn('notifyNewRegistrationRequest: нет office_id', { id: requestData?.id });
                return;
            }

            const office = await Office.findByPk(requestData.office_id);
            if (!office) {
                logger.warn('notifyNewRegistrationRequest: офис не найден', { office_id: requestData.office_id });
                return;
            }

            const recipients = await User.findAll({
                where: {
                    role: 'admin-worker',
                },
            });

            const title = 'Новый пользователь запрашивает доступ';
            const content = `Офис: ${office.name}`;

            if (recipients.length === 0) {
                logger.debug('notifyNewRegistrationRequest: нет получателей', { office_id: requestData.office_id });
                return;
            }

            const notifPayloads = recipients.map((r) => ({
                user_id: r.id,
                title,
                content,
                is_read: false,
            }));
            const createdNotifications = await Notification.bulkCreate(notifPayloads);

            const pushData = {
                type: 'new_registration_request',
                registration_request_id: String(requestData.id),
                office_id: String(requestData.office_id),
                office_name: office.name,
                timestamp: new Date().toISOString(),
            };

            await Promise.allSettled(
                recipients.map((r) => {
                    const notification = createdNotifications.find((n) => n.user_id === r.id);
                    return NotificationService.sendPushNotification(
                        r.id,
                        title,
                        content,
                        pushData,
                        notification?.id
                    );
                })
            );
        } catch (error) {
            logger.error('Ошибка при отправке уведомлений о новом запросе', { error: error?.message });
        }
    }

    // Вспомогательный метод для дедупликации пользователей
    static _uniqueUsers(users) {
        const seen = new Set();
        return users.filter(user => {
            if (seen.has(user.id)) {
                return false;
            }
            seen.add(user.id);
            return true;
        });
    }

    /**
     * Отправить push-уведомление пользователю
     */
    static async sendPushNotification(userId, title, body, data = {}, notificationId = null) {
        try {
            const result = await fcmService.sendToUser(userId, title, body, data);
            
            // Логируем push уведомление
            if (notificationId) {
                await NotificationLogService.createNotificationLog({
                    notificationId: notificationId,
                    userId: userId,
                    notificationType: data.type || 'push_notification',
                    deliveryMethod: 'push',
                    status: result.success ? 'delivered' : 'failed',
                    errorMessage: result.success ? null : result.message
                });
            }
            
            if (result.success) {
                logger.debug('Push отправлен пользователю', { userId, title });
            } else {
                logger.warn('Push пользователю не отправлен', { userId, message: result?.message });
            }
            return result;
        } catch (error) {
            // Логируем ошибку push уведомления
            if (notificationId) {
                await NotificationLogService.createNotificationLog({
                    notificationId: notificationId,
                    userId: userId,
                    notificationType: data.type || 'push_notification',
                    deliveryMethod: 'push',
                    status: 'failed',
                    errorMessage: error.message
                });
            }
            
            logger.error('Ошибка отправки push пользователю', { userId, error: error?.message });
            return { success: false, message: error.message };
        }
    }

    /**
     * Отправить push-уведомление на тему
     */
    static async sendPushNotificationToTopic(topic, title, body, data = {}) {
        try {
            const result = await fcmService.sendToTopic(topic, title, body, data);
            if (result.success) {
                logger.debug('Push отправлен на тему', { topic, type: data?.type || 'general' });
            } else {
                logger.warn('Push на тему не отправлен', { topic, message: result?.message });
            }
            return result;
        } catch (error) {
            logger.error('Ошибка отправки push на тему', { topic, error: error?.message });
            return { success: false, message: error.message };
        }
    }

    /**
     * Отправить push-уведомление всем активным пользователям
     */
    static async sendPushNotificationToAll(title, body, data = {}) {
        try {
            // Получаем все активные токены
            const stats = await fcmService.getTokenStats();
            if (!stats.success || stats.stats.active === 0) {
                logger.debug('Нет активных FCM токенов для массовой рассылки');
                return { success: false, message: 'No active tokens' };
            }

            // Получаем все активные токены
            const allTokens = await fcmService.getAllActiveTokens();
            if (!allTokens.success || allTokens.tokens.length === 0) {
                logger.debug('Нет активных FCM токенов для массовой рассылки');
                return { success: false, message: 'No active tokens' };
            }

            const tokenList = allTokens.tokens.map(t => t.token);
            const result = await fcmService.sendMulticast(tokenList, title, body, data);

            if (result.success) {
                logger.debug('Массовое push отправлено', { successCount: result.successCount, failureCount: result.failureCount });
            } else {
                logger.warn('Массовое push не отправлено', { message: result?.message });
            }

            return result;
        } catch (error) {
            logger.error('Ошибка отправки массового push', { error: error?.message });
            return { success: false, message: error.message };
        }
    }
}

export default NotificationService;