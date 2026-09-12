import fs from 'fs/promises';
import {
    RequestGroup,
    Request,
    User,
    Office,
    Executor,
    ServiceCategory,
    RequestPhoto,
    RequestRating,
    ClientRating
} from '../models/init.model.js';
import { RecurringTaskInstance } from '../models/recurringTaskInstance.model.js';
import { Op, literal } from 'sequelize';
import RequestService from "./request.service.js";
import RequestLogger from "../utils/requestLogger.js";
import NotificationService from "./notification.service.js";
import { BadRequestError, NotFoundError } from '../errors/errors.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';
import { sequelize } from '../config/database.config.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import logger from '../utils/winston/logger.js';

class RequestGroupService {

    // Функция для вычисления среднего значения оценок для подзаявки
    static calculateAverageRating(ratings) {
        if (!ratings || ratings.length === 0) {
            return null;
        }
        const ratingsValues = ratings.map(r => r.rating).filter(r => r !== null && r !== undefined);
        if (ratingsValues.length === 0) {
            return null;
        }
        const sum = ratingsValues.reduce((a, b) => a + b, 0);
        const average = sum / ratingsValues.length;
        return Math.round(average); // Округляем до целого числа для отображения звезд
    }

    // Функция для получения всех комментариев из оценок
    static getAllComments(ratings) {
        if (!ratings || ratings.length === 0) {
            return [];
        }
        return ratings
            .map(r => r.comment)
            .filter(c => c !== null && c !== undefined && c.trim() !== '');
    }

    // Функция для обработки оценок в заявках - вычисляет среднее и собирает комментарии
    static processRatingsForRequestGroups(requestGroups) {
        if (!requestGroups || !Array.isArray(requestGroups)) {
            return requestGroups;
        }
        
        return requestGroups.map(group => {
            // Преобразуем Sequelize объект в обычный объект если нужно
            const groupData = group.toJSON ? group.toJSON() : group;
            
            if (!groupData.requests || !Array.isArray(groupData.requests)) {
                return groupData;
            }
            
            const processedRequests = groupData.requests.map(request => {
                // Преобразуем Sequelize объект в обычный объект если нужно
                const requestData = request.toJSON ? request.toJSON() : request;
                
                if (!requestData.ratings || !Array.isArray(requestData.ratings)) {
                    return requestData;
                }
                
                // Преобразуем каждую оценку в обычный объект если нужно
                const ratingsData = requestData.ratings.map(r => r.toJSON ? r.toJSON() : r);
                
                const averageRating = this.calculateAverageRating(ratingsData);
                const allComments = this.getAllComments(ratingsData);
                
                // Возвращаем новый объект с вычисленным средним значением и всеми комментариями
                return {
                    ...requestData,
                    ratings: [{
                        rating: averageRating,
                        comments: allComments,
                        count: ratingsData.length
                    }]
                };
            });
            
            return {
                ...groupData,
                requests: processedRequests
            };
        });
    }

    // Функция для получения просроченных заявок через SQL запрос (как в statisticsService)
    static async getOverdueRequestGroups(userId, userRole) {
        let whereCondition = {};
        
        if (userRole === 'admin-worker') {
            const user = await User.findByPk(userId);
            whereCondition = {
                office_id: user.office_id
            };
        } else if (userRole === 'department-head') {
            const user = await User.findByPk(userId);
            whereCondition = {
                office_id: user.office_id,
            };
        } else if (userRole === 'manager') {
            whereCondition = {};
        }

        logger.debug('getOverdueRequestGroups whereCondition', { userRole, whereCondition });

        const overdueRequestGroups = await RequestGroup.findAll({
            where: {
                ...whereCondition,
                status: 'completed',
                date_submitted: { [Op.ne]: null },
                request_type: { [Op.ne]: 'recurring' }
            },
            include: [{
                model: Request,
                as: 'requests',
                attributes: [],
                where: literal(`"requests"."sla" IS NOT NULL AND "requests"."actual_completion_date" IS NOT NULL AND (
                    CASE 
                        WHEN "requests"."sla" LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'h', '') || ' hours')::interval
                        WHEN "requests"."sla" LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'd', '') || ' days')::interval
                        WHEN "requests"."sla" LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'w', '') || ' weeks')::interval
                        WHEN "requests"."sla" LIKE '%m' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'm', '') || ' months')::interval
                        WHEN "requests"."sla" LIKE '%y' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'y', '') || ' years')::interval
                    END
                ) < "requests"."actual_completion_date"`)
            }],
            attributes: ['id'],
            raw: true
        });

        logger.debug('getOverdueRequestGroups result', { count: overdueRequestGroups.length, ids: overdueRequestGroups.map(r => r.id) });
        return overdueRequestGroups.map(r => r.id);
    }

    static async createRequestGroup(req) {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        let createdRequestGroup;

        // Оборачиваем всё в транзакцию
        const tx = await sequelize.transaction();
        try {
            // Устанавливаем date_submitted если статус awaiting_assignment
            // Обрабатываем request_type, если он пришел как массив
            let requestType = req.body.request_type;
            if (Array.isArray(requestType)) {
                requestType = requestType[0]; // Берем первый элемент массива
            }
            
            const requestData = {
                client_id: user.id,
                office_id: user.office_id,
                ...req.body,
                request_type: requestType // Используем исправленное значение
            };
            
            // Если статус awaiting_assignment или assigned, устанавливаем date_submitted
            if (req.body.status === 'awaiting_assignment' || req.body.status === 'assigned') {
                requestData.date_submitted = new Date();
            }

            // Если это повторяющаяся задача, устанавливаем дополнительные поля
            if (req.body.request_type === 'recurring') {
                requestData.recurring_status = 'active';
                requestData.next_due_date = req.body.start_date || new Date();
            }
            
            const requestGroup = await RequestGroup.create(requestData, { transaction: tx });

            // Если это повторяющаяся задача, создаем первый экземпляр
            if (req.body.request_type === 'recurring') {
                await RecurringTaskInstance.create({
                    request_group_id: requestGroup.id,
                    due_date: req.body.start_date || new Date(),
                    status: 'pending'
                }, { transaction: tx });
            }

            // Загружаем фото в Cloudinary (сжатие в WebP) и сохраняем ссылки в БД
            if (req.files && req.files.length > 0) {
                let uploadResults;
                try {
                    uploadResults = await Promise.all(
                        req.files.map((file) => uploadToCloudinary(file.path, { folder: 'request_photos' }))
                    );
                } catch (uploadErr) {
                    const msg = (uploadErr.message || '').toLowerCase();
                    if (msg.includes('file size too large') || msg.includes('maximum is')) {
                        throw new BadRequestError('Размер фотографии превышает допустимый лимит (10 МБ). Пожалуйста, выберите фото меньшего размера или сожмите изображение.');
                    }
                    throw uploadErr;
                }
                const photoPromises = uploadResults.map((result) =>
                    RequestPhoto.create(
                        {
                            request_id: requestGroup.id,
                            photo_url: result.secure_url,
                            type: "before",
                        },
                        { transaction: tx }
                    )
                );
                await Promise.all(photoPromises);
                // Удаляем временные файлы
                await Promise.all(req.files.map((f) => fs.unlink(f.path).catch(() => {})));
            }

            // Создаём подзаявки в рамках транзакции
            const sub_requests = JSON.parse(req.body.sub_requests)
            await RequestService.createRequest(requestGroup.id, sub_requests, tx);

            createdRequestGroup = await this.getRequestGroupById(requestGroup.id, tx);

            await tx.commit();
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }

        Promise.resolve(
            RequestLogger.logRequestCreated(
                createdRequestGroup.id,
                user.id,
                createdRequestGroup,
                req ? RequestLogger.getIpAddress(req) : null,
                req ? RequestLogger.getUserAgent(req) : null
            )
        ).catch(err => logger.error('Ошибка при логировании создания заявки', { error: err?.message }));

        if (req.user.role === 'admin-worker') {
            Promise.resolve(
                NotificationService.sendNotification({
                    userId: createdRequestGroup.client_id,
                    request: createdRequestGroup,
                    type: 'awaiting_assignment',
                    req: req
                })
            ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));
        } else {
            Promise.resolve(
                NotificationService.sendNotification({
                    userId: user.id,
                    request: createdRequestGroup,
                    type: 'new_request',
                    req: req
                })
            ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));
        }


        return createdRequestGroup;
    }

    static async getAllRequestGroups(page = 1, pageSize = 10, user, status = null, priority = null, officeId = null) {
        if (user?.role === 'manager') {
            return await this.getManagerRequestGroup(page, pageSize, status, priority);
        } else if (user?.role === 'client') {
            return await this.getRequestGroupsByUser(user.id, page, pageSize, status);
        } else if (user?.role === 'admin-worker') {
            return await this.getAdminRequestGroup(page, pageSize, user.id, status, priority, officeId);
        } else if (user?.role === 'department-head') {
            return await this.getDepartmentRequestGroup(user.id, status, priority);
        } else {
            return await this.getExecutorRequestGroup(user.id, status);
        }

    }

    static async getRequestGroupById(id, transaction = null) {
        return await RequestGroup.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone', 'role'],
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name', 'city', 'address']
                },
                { model: RequestPhoto, as: 'photos', attributes: ['photo_url', 'type', 'created_at'] },
                {
                    model: Request,
                    as: 'requests',
                    order: [['sub_request_number', 'ASC']],
                    include: [
                        {
                            model: Executor,
                            as: 'executors',
                            attributes: ['id', 'specialty'],
                            through: { attributes: ['role'] },
                            include: [
                                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                            ]
                        },
                        { model: ServiceCategory, as: 'category' }
                    ]
                }
            ],
            transaction
        });
    }

    static async updateRequestGroupStatus(groupId, transaction) {
        const requestGroup = await RequestGroup.findByPk(groupId, {
            include: [
                {
                    model: Request,
                    as: 'requests',
                    attributes: ['status']
                }
            ], transaction
        });

        if (!requestGroup) {
            throw new NotFoundError('Request group not found');
        }

        const requests = requestGroup.requests;
        if (requests.length === 0) {
            await RequestGroup.destroy({
                where: {id: requestGroup.id},
                transaction
            });
            return;
        }

        // Определяем статус группы на основе статусов подзаявок
        let newStatus = 'in_progress';

        const allCompleted = requests.every(req => req.status === 'completed');
        const anyRejected = requests.some(req => req.status === 'rejected');
        const anyAwaiting = requests.some(req =>
            ['awaiting_assignment', 'awaiting_sla'].includes(req.status)
        )
        const anyInProgress = requests.some(req =>
            ['execution', 'assigned'].includes(req.status)
        );

        if (allCompleted) {
            newStatus = 'completed';
        } else if (anyRejected) {
            newStatus = 'rejected';
        } else if (anyInProgress) {
            newStatus = 'execution';
        } else if (anyAwaiting) {
            newStatus = 'awaiting_assignment';
        }

        // Обновляем статус группы
        await requestGroup.update({ status: newStatus }, { transaction: transaction });

        if (transaction) {
            return requestGroup;
        }
        return await this.getRequestGroupById(groupId);
    }

    static async deleteRequestGroup(groupId) {
        const requestGroup = await RequestGroup.findByPk(groupId);
        if (!requestGroup) {
            return false;
        }

        await requestGroup.destroy();
        return true;
    }

    static async patchUpdateRequestGroup(group_id, req) {
        const requestGroup = await RequestGroup.findByPk(group_id);
        if (!requestGroup) {
            throw new NotFoundError('Request group not found');
        }

        if (req.body.patch_code === 1) {
            return await this.handleApproveRequestGroup(group_id, req);
        } else if (req.body.patch_code === 2) {
            return await this.handleRejectRequestGroup(group_id, req);
        } else {
            throw new NotFoundError('Incorrect patch code');
        }
    }

    static async updateRequestGroup(group_id, updateData) {
        const requestGroup = await RequestGroup.findByPk(group_id);
        if (!requestGroup) {
            throw new NotFoundError('Request group not found');
        }

        // Проверяем, что заявка не завершена
        if (requestGroup.status === 'completed') {
            throw new BadRequestError('Cannot edit completed request');
        }

        const tx = await sequelize.transaction();
        try {
            // Обновляем основные поля группы заявок
            const groupUpdateFields = {};
            if (updateData.request_type) groupUpdateFields.request_type = updateData.request_type;
            if (updateData.location_detail) groupUpdateFields.location_detail = updateData.location_detail;
            
            if (Object.keys(groupUpdateFields).length > 0) {
                await requestGroup.update(groupUpdateFields, { transaction: tx });
            }

            // Обновляем подзаявки если есть данные для них
            if (updateData.sub_requests && Array.isArray(updateData.sub_requests)) {
                for (const subRequestUpdate of updateData.sub_requests) {
                    const subRequest = await Request.findByPk(subRequestUpdate.id, { transaction: tx });
                    if (subRequest && subRequest.request_group_id === parseInt(group_id)) {
                        const updateFields = {};
                        if (subRequestUpdate.category_id) updateFields.category_id = subRequestUpdate.category_id;
                        if (subRequestUpdate.complexity) updateFields.complexity = subRequestUpdate.complexity;
                        if (subRequestUpdate.sla) updateFields.sla = subRequestUpdate.sla;
                        if (subRequestUpdate.title) updateFields.title = subRequestUpdate.title;
                        if (subRequestUpdate.description) updateFields.description = subRequestUpdate.description;
                        
                        if (Object.keys(updateFields).length > 0) {
                            await subRequest.update(updateFields, { transaction: tx });
                        }
                    }
                }
            }

            await tx.commit();
            
            // Возвращаем обновленную группу заявок
            return await this.getRequestGroupById(group_id);
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }
    }

    static async handleApproveRequestGroup(group_id, req) {
        const { sub_requests, request_type, location_detail, office_id } = req.body;
        sub_requests.forEach((subReq) => {
            if (!subReq.complexity || !subReq.sla) {
                throw new BadRequestError('complexity, sla is required when status is awaiting_assignment');
            }
        });

        const tx = await sequelize.transaction();
        let requestGroup;
        try {
            requestGroup = await RequestGroup.findByPk(group_id, {transaction: tx});
            if (!requestGroup) {
                throw new NotFoundError('Request not found');
            }
            if (requestGroup.status !== 'in_progress') {
                throw new BadRequestError('Request group not available for approve');
            }

            if (office_id !== undefined && office_id !== null) {
                const parsedOfficeId = Number(office_id);
                if (!Number.isInteger(parsedOfficeId) || parsedOfficeId <= 0) {
                    throw new BadRequestError('office_id must be a positive integer');
                }

                const office = await Office.findByPk(parsedOfficeId, { transaction: tx });
                if (!office) {
                    throw new NotFoundError('Office not found');
                }

                requestGroup.office_id = parsedOfficeId;
            }

            const subRequests = await Request.findAll({
                where: {request_group_id: requestGroup.id},
            })
            if (subRequests?.length !== sub_requests?.length) {
                throw new BadRequestError('Error sub requests');
            }

            for (const request of subRequests) {
                for (const subReq of sub_requests) {
                    if (request.id === subReq.id) {
                        await Request.update({
                            status: 'awaiting_assignment',
                            sla: subReq.sla,
                            complexity: subReq.complexity,
                            category_id: subReq.category_id
                        }, {where: {id: subReq.id}, transaction: tx});
                    }
                }
            }

            requestGroup.status = 'awaiting_assignment';
            requestGroup.request_type = request_type;
            requestGroup.date_submitted = Date.now();
            
            // Обновляем локацию в офисе если она передана
            if (location_detail !== undefined) {
                requestGroup.location_detail = location_detail;
            }
            
            await requestGroup.save({ transaction: tx });

            await tx.commit();
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }

        Promise.resolve(
            RequestLogger.logStatusChanged(
                requestGroup.id,
                req.user.id,
                'in_progress',
                'awaiting_assignment',
                'Заявка принята администратором',
                req ? RequestLogger.getIpAddress(req) : null,
                req ? RequestLogger.getUserAgent(req) : null
            )
        ).catch(err => logger.error('Ошибка при логировании изменения статуса', { error: err?.message }));

        const message = `
          Новая заявка для обработки
          ID: ${requestGroup.id}
          Пожалуйста, перейдите в систему, чтобы принять заявку.
      `.trim();
        Promise.resolve(
            NotificationService.sendNotification({
                userId: requestGroup.client_id,
                request: requestGroup,
                type: 'awaiting_assignment',
                content: message,
                req: req
            })
        ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));
        return requestGroup;
    }

    static async handleRejectRequestGroup(group_id, req) {
        const { rejection_reason } = req.body;
        if (!rejection_reason || rejection_reason.trim() === '') {
            throw new BadRequestError('Rejection reason is required when status is rejected');
        }

        let requestGroup;
        const tx = await sequelize.transaction();
        try {
            requestGroup = await RequestGroup.findByPk(group_id, {transaction: tx});
            if (!requestGroup) {
                throw new NotFoundError('Request group not found');
            }
            if (requestGroup.status !== 'in_progress') {
                throw new BadRequestError('Request group not available for reject');
            }
            await RequestGroup.update({status: 'rejected'}, {
                where: { id: requestGroup.id },
                transaction: tx
            });

            await Request.update({status: 'rejected'}, {
                where: { request_group_id: requestGroup.id },
                transaction: tx
            })

            await tx.commit();
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }

        Promise.resolve(
            NotificationService.sendNotification({
                userId: requestGroup.client_id,
                request: requestGroup,
                type: 'reject_request',
                content: req.body.rejection_reason
            })
        ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));

        Promise.resolve(
            RequestLogger.logRequestRejected(
                requestGroup.id,
                req.user.id,
                req.body.rejection_reason,
                req ? RequestLogger.getIpAddress(req) : null,
                req ? RequestLogger.getUserAgent(req) : null
            )
        ).catch(err => {
            logger.error('Ошибка при логировании отклонения заявки', { error: err?.message });
        });

        return requestGroup;
    }

    static async getRequestGroupsByUser(userId, page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await RequestGroup.findAndCountAll({
            offset,
            limit: pageSize,
            where: {
                client_id: userId,
                request_type: {
                    [Op.ne]: 'recurring' // Исключаем повторяющиеся задачи
                }
            },
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone', 'role'],
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name', 'city']
                },
                { model: RequestPhoto, as: 'photos', attributes: ['photo_url', 'type', 'created_at'] },
                {
                    model: Request,
                    as: 'requests',
                    include: [
                        {
                            model: Executor,
                            as: 'executors',
                            attributes: ['id', 'specialty'],
                            through: { attributes: ['role'] },
                            include: [
                                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                            ]
                        },
                        { model: ServiceCategory, as: 'category' },
                        {
                            model: RequestRating,
                            as: 'ratings',
                            required: false
                        }
                    ]
                },
                {
                    model: ClientRating,
                    as: 'clientRatings',
                    where: { client_id: userId },
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'ratedByUser',
                            attributes: ['id', 'full_name']
                        }
                    ]
                }
            ],
            order: [
                ['created_date', 'DESC'],
                [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
            ]
        });
        
        // Обрабатываем оценки: вычисляем среднее значение и собираем все комментарии
        const processedRows = this.processRatingsForRequestGroups(rows);
        
        return {
            total: count,
            totalPages: Math.ceil(count / pageSize),
            page,
            pageSize,
            requests: processedRows
        };
    }

    static async getManagerRequestGroup(page = 1, pageSize = 10, status = null, priority = null) {
        // Если запрашиваются просроченные заявки, используем специальную логику
        if (status === 'overdue') {
            const overdueIds = await this.getOverdueRequestGroups(null, 'manager');
            
            // Применяем фильтр по приоритету к просроченным заявкам
            let filteredOverdueIds = overdueIds;
            if (priority && priority !== 'all') {
                const overdueWithPriority = await RequestGroup.findAll({
                    where: {
                        id: { [Op.in]: overdueIds },
                        request_type: priority
                    },
                    attributes: ['id'],
                    raw: true
                });
                filteredOverdueIds = overdueWithPriority.map(r => r.id);
            }
            
            const offset = (page - 1) * pageSize;
            const limit = pageSize;
            
            // Получаем просроченные заявки с правильной пагинацией
            const { count, rows } = await RequestGroup.findAndCountAll({
                offset,
                limit,
                where: {
                    id: { [Op.in]: filteredOverdueIds }
                },
                include: [
                    {
                        model: User,
                        as: 'client',
                        attributes: ['id', 'full_name', 'phone', 'role']
                    },
                    {
                        model: Office,
                        as: 'office',
                        attributes: ['id', 'name', 'city']
                    },
                    { model: RequestPhoto, as: 'photos', attributes: ['photo_url', 'type', 'created_at'] },
                    {
                        model: Request,
                        as: 'requests',
                        include: [
                            {
                                model: Executor,
                                as: 'executors',
                                attributes: ['id', 'specialty'],
                                through: { attributes: ['role'] },
                                include: [
                                    { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                                ]
                            },
                            { model: ServiceCategory, as: 'category' },
                            {
                                model: RequestRating,
                                as: 'ratings',
                                required: false
                            }
                        ]
                    }
                ],
                order: [
                    ['created_date', 'DESC'],
                    [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
                ]
            });
            
            // Обрабатываем оценки: вычисляем среднее значение и собираем все комментарии
            const processedRows = this.processRatingsForRequestGroups(rows);
            
            return {
                total: count,
                totalPages: Math.ceil(count / pageSize),
                page,
                pageSize,
                data: processedRows
            };
        }
        
        // Обычная логика для других статусов
        const offset = (page - 1) * pageSize;

        // Создаем условия фильтрации
        const whereConditions = {
            request_type: {
                [Op.ne]: 'recurring' // Исключаем повторяющиеся задачи
            }
        };

        // Добавляем фильтр по статусу если он указан
        if (status && status !== 'overdue') {
            whereConditions.status = status;
        }

        // Добавляем фильтр по приоритету если он указан
        if (priority && priority !== 'all') {
            whereConditions.request_type = priority;
        }

        const { count, rows } = await RequestGroup.findAndCountAll({
            offset,
            limit: pageSize,
            where: whereConditions,
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name', 'city']
                },
                { model: RequestPhoto, as: 'photos', attributes: ['photo_url', 'type', 'created_at'] },
                {
                    model: Request,
                    as: 'requests',
                    include: [
                        {
                            model: Executor,
                            as: 'executors',
                            attributes: ['id', 'specialty'],
                            through: { attributes: ['role'] },
                            include: [
                                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                            ]
                        },
                            { model: ServiceCategory, as: 'category' },
                            {
                                model: RequestRating,
                                as: 'ratings',
                                required: false
                            }
                    ]
                }
            ],
            order: [
                ['created_date', 'DESC'],
                [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
            ]
        });
        
        // Обрабатываем оценки: вычисляем среднее значение и собираем все комментарии
        const processedRows = this.processRatingsForRequestGroups(rows);
        
        return {
            total: count,
            totalPages: Math.ceil(count / pageSize),
            page,
            pageSize,
            data: processedRows
        };
    }

    static async getAdminRequestGroup(page = 1, pageSize = 10, userId, status = null, priority = null, officeId = null) {
        const offset = (page - 1) * pageSize;
        const user = await User.findByPk(userId);
        const parsedOfficeId = officeId && officeId !== 'all' ? Number(officeId) : null;

        // Создаем условия фильтрации
        const whereConditions = {
            [Op.and]: [
                { request_type: { [Op.ne]: 'recurring' } }
            ]
        };

        // Добавляем фильтр по статусу если он указан
        if (status && status !== 'overdue') {
            whereConditions[Op.and].push({ status: status });
        } else if (status === 'overdue') {
            // Для просроченных заявок включаем только завершенные заявки
            whereConditions[Op.and].push({ status: 'completed' });
        }

        // Добавляем фильтр по приоритету если он указан
        if (priority && priority !== 'all') {
            whereConditions[Op.and].push({ request_type: priority });
        }
        if (parsedOfficeId && Number.isInteger(parsedOfficeId)) {
            whereConditions[Op.and].push({ office_id: parsedOfficeId });
        }

        let count, rows, filteredRows;
        
        // Если запрашиваются просроченные заявки, используем специальную логику
        if (status === 'overdue') {
            const overdueIds = await this.getOverdueRequestGroups(userId, 'manager');
            logger.debug('Admin-worker overdue IDs', { overdueIds });
            
            // Получаем все просроченные заявки без пагинации
            const allOverdueRequests = await RequestGroup.findAll({
                where: {
                    id: { [Op.in]: overdueIds },
                    ...(parsedOfficeId && Number.isInteger(parsedOfficeId) ? { office_id: parsedOfficeId } : {})
                },
                include: [
                    {
                        model: User,
                        as: 'client',
                        attributes: ['id', 'full_name', 'phone', 'role']
                    },
                    {
                        model: Office,
                        as: 'office',
                        attributes: ['id', 'name', 'city']
                    },
                    { model: RequestPhoto, as: 'photos' },
                    {
                        model: Request,
                        as: 'requests',
                        include: [
                            {
                                model: Executor,
                                as: 'executors',
                                attributes: ['id', 'specialty'],
                                through: { attributes: ['role'] },
                                include: [
                                    { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                                ]
                            },
                            { model: ServiceCategory, as: 'category' },
                            {
                                model: RequestRating,
                                as: 'ratings',
                                required: false
                            }
                        ]
                    },
                    {
                        model: ClientRating,
                        as: 'clientRatings',
                        where: { rated_by: userId },
                        required: false,
                        include: [
                            {
                                model: User,
                                as: 'ratedClient',
                                attributes: ['id', 'full_name']
                            }
                        ]
                    }
                ],
                order: [
                    ['created_date', 'DESC'],
                    [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
                ]
            });
            
            // Применяем пагинацию к результату
            count = allOverdueRequests.length;
            rows = allOverdueRequests.slice(offset, offset + pageSize);
            filteredRows = this.processRatingsForRequestGroups(rows);
            
            logger.debug('Overdue requests', { total: allOverdueRequests.length, afterPagination: rows.length });
        } else {
            // Обычная логика для других статусов
            const result = await RequestGroup.findAndCountAll({
                offset,
                limit: pageSize,
                where: whereConditions,
                include: [
                    {
                        model: User,
                        as: 'client',
                        attributes: ['id', 'full_name', 'phone', 'role']
                    },
                    {
                        model: Office,
                        as: 'office',
                        attributes: ['id', 'name', 'city']
                    },
                    { model: RequestPhoto, as: 'photos' },
                    {
                        model: Request,
                        as: 'requests',
                        include: [
                            {
                                model: Executor,
                                as: 'executors',
                                attributes: ['id', 'specialty'],
                                through: { attributes: ['role'] },
                                include: [
                                    { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                                ]
                            },
                            { model: ServiceCategory, as: 'category' },
                            {
                                model: RequestRating,
                                as: 'ratings',
                                required: false
                            }
                        ]
                    },
                    {
                        model: ClientRating,
                        as: 'clientRatings',
                        where: { rated_by: userId },
                        required: false,
                        include: [
                            {
                                model: User,
                                as: 'ratedClient',
                                attributes: ['id', 'full_name']
                            }
                        ]
                    }
                ],
                order: [
                    ['created_date', 'DESC'],
                    [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
                ]
            });
            
            count = result.count;
            rows = result.rows;
            filteredRows = this.processRatingsForRequestGroups(rows);
        }
        
        const myRequests = filteredRows.filter(req => req.client_id === user.id);
        const otherRequests = filteredRows.filter(req => req.client_id !== user.id);

        return {
            myRequests,
            otherRequests,
            total: count,
            page,
            pageSize
        };
    }

    static async getDepartmentRequestGroup(userId, status = null, priority = null) {
        const user = await User.findByPk(userId);

        // Создаем условия фильтрации
        const whereConditions = {
            office_id: user.office_id,
            request_type: {
                [Op.ne]: 'recurring' // Исключаем повторяющиеся задачи
            },
            [Op.or]: [
                { client_id: user.id },
                // in_progress — стартовый статус заявки, созданной клиентом.
                // Без него входящие заявки офиса не видны офис-менеджеру вообще,
                // и назначить исполнителя некому.
                {
                    status: [
                        'in_progress',
                        'awaiting_assignment',
                        'awaiting_sla',
                        'assigned',
                        'execution',
                        'completed',
                    ],
                }
            ],
        };

        // Добавляем фильтр по статусу если он указан
        if (status && status !== 'overdue') {
            whereConditions.status = status;
        } else if (status === 'overdue') {
            // Для просроченных заявок включаем только завершенные заявки
            whereConditions.status = 'completed';
        }

        // Добавляем фильтр по приоритету если он указан
        if (priority && priority !== 'all') {
            whereConditions.request_type = priority;
        }

        // Получаем обычные заявки (исключаем повторяющиеся)
        const regularRequests = await RequestGroup.findAll({
            where: whereConditions,
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name', 'city']
                },
                { model: RequestPhoto, as: 'photos', attributes: ['photo_url', 'type', 'created_at'] },
                {
                    model: Request,
                    as: 'requests',
                    required: false,
                    include: [
                        {
                            model: Executor,
                            as: 'executors',
                            attributes: ['id', 'specialty'],
                            through: { attributes: ['role'] },
                            include: [
                                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                            ]
                        },
                        { model: ServiceCategory, as: 'category' },
                        {
                            model: RequestRating,
                            as: 'ratings',
                            required: false
                        }
                    ]
                }
            ],
            distinct: true,
            order: [
                ['created_date', 'DESC'],
                [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
            ]
        });

        // Обрабатываем оценки: вычисляем среднее значение и собираем все комментарии
        const processedRegularRequests = this.processRatingsForRequestGroups(regularRequests);

        // Получаем повторяющиеся задачи с фильтрацией по категориям
        const recurringRequests = await RequestGroup.findAll({
            where: {
                office_id: user.office_id,
                request_type: 'recurring'
            },
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name', 'city']
                },
                { model: RequestPhoto, as: 'photos', attributes: ['photo_url'] },
                {
                    model: Request,
                    as: 'requests',
                    required: false,
                    order: [['sub_request_number', 'ASC']],
                    include: [
                        {
                            model: Executor,
                            as: 'executors',
                            attributes: ['id', 'specialty'],
                            through: { attributes: ['role'] },
                            include: [
                                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                            ]
                        },
                        { model: ServiceCategory, as: 'category' },
                        {
                            model: RequestRating,
                            as: 'ratings',
                            required: false
                        }
                    ]
                }
            ],
            distinct: true,
            order: [['created_date', 'DESC']]
        });

        // Обрабатываем оценки для повторяющихся (результат не объединялся с allRequests в текущей логике)
        this.processRatingsForRequestGroups(recurringRequests);

        // Объединяем обычные и повторяющиеся заявки
        let allRequests = [...processedRegularRequests];

        // Если запрашиваются просроченные заявки, получаем их через SQL запрос
        if (status === 'overdue') {
            const overdueIds = await this.getOverdueRequestGroups(user.id, 'department-head');
            allRequests = allRequests.filter(requestGroup => overdueIds.includes(requestGroup.id));
        }

        const myRequests = allRequests.filter(req => req.client_id === user.id);
        const otherRequests = allRequests.filter(req => req.client_id !== user.id);

        return { myRequests, otherRequests };
    }

    static async getExecutorRequestGroup(userId, status = null) {
        const executor = await Executor.findOne({
            where: { user_id: userId }
        });
        if (!executor) {
            return { assignedRequests: [], completedRequests: [], myRequests: [] };
        }
        const whereConditions = {
            [Op.or]: [
                { client_id: userId },
                {
                    id: {
                        [Op.in]: sequelize.literal(`(
                            SELECT requests.request_group_id
                            FROM requests
                            INNER JOIN request_executors ON requests.id = request_executors.request_id
                            WHERE request_executors.executor_id = ${executor.id}
                        )`)
                    }
                }
            ]
        };
        if (status && status !== 'overdue') {
            whereConditions.status = status;
        }
        const allRequests = await RequestGroup.findAll({
            include: [
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone', 'role']
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name', 'city']
                },
                { model: RequestPhoto, as: 'photos', attributes: ['photo_url', 'type', 'created_at'] },
                {
                    model: Request,
                    as: 'requests',
                    required: false, // Include all requests under the group
                    include: [
                        {
                            model: Executor,
                            as: 'executors',
                            attributes: ['id', 'specialty'],
                            through: { attributes: ['role'] },
                            include: [
                                { model: User, as: 'user', attributes: ['id', 'full_name', 'phone'] }
                            ]
                        },
                        { model: ServiceCategory, as: 'category' },
                        {
                            model: RequestRating,
                            as: 'ratings',
                            required: false
                        }
                    ]
                },
                {
                    model: ClientRating,
                    as: 'clientRatings',
                    where: { rated_by: userId },
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'ratedClient',
                            attributes: ['id', 'full_name']
                        }
                    ]
                }
            ],
            where: whereConditions,
            order: [
                ['created_date', 'DESC'],
                [{ model: Request, as: 'requests' }, 'sub_request_number', 'ASC']
            ]
        });

        // Обрабатываем оценки: вычисляем среднее значение и собираем все комментарии
        const processedAllRequests = this.processRatingsForRequestGroups(allRequests);
        
        const myRequests = processedAllRequests.filter(req => req.client_id === userId);
        const assignedRequests = processedAllRequests.filter(req => req.status !== 'completed' && req.client_id !== userId);
        const completedRequests = processedAllRequests.filter(req => req.status === 'completed' && req.client_id !== userId);

        logger.debug(`processed requests for executor: ${processedAllRequests.length}`)
        return { assignedRequests, completedRequests, myRequests };
    }

}

export default RequestGroupService;
