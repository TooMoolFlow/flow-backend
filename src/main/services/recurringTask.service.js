import { RequestGroup, Request, RequestPhoto, RequestLog } from '../models/init.model.js';
import { RecurringTaskInstance } from '../models/recurringTaskInstance.model.js';
import { RequestExecutor } from '../models/init.model.js';
import { User } from '../models/init.model.js';
import { ServiceCategory } from '../models/init.model.js';
import { Executor } from '../models/init.model.js';
import { Office } from '../models/init.model.js';
import { sequelize } from '../config/database.config.js';
import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { addDaysOnlyLocal, toDateOnlyLocal, toIntervalDays } from '../utils/dateUtils.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import logger from '../utils/winston/logger.js';

class RecurringTaskService {

    /** Создаёт повторяющуюся задачу. body + user приходят с контроллера; client_id/office_id задаются по роли. */
    static async createRecurringTask(body, user) {
        const taskData = {
            ...body,
            client_id: user.role === 'admin-worker' ? user.id : body.client_id,
            office_id: user.role === 'department-head' && user.office_id ? user.office_id : body.office_id
        };
        return this._createRecurringTask(taskData);
    }

    static async _createRecurringTask(taskData) {
        const transaction = await sequelize.transaction();

        try {
            if (!taskData.recurrence_type) {
                throw new BadRequestError('recurrence_type is required for recurring tasks');
            }

            let startDate;
            if (taskData.start_date) {
                // Если start_date приходит как строка в формате 'YYYY-MM-DD'
                if (typeof taskData.start_date === 'string') {
                    // Создаем дату в UTC
                    startDate = new Date(taskData.start_date + 'T00:00:00.000Z');
                } else {
                    startDate = new Date(taskData.start_date);
                }
            } else {
                // Используем текущую дату в UTC
                const now = new Date();
                startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            }
            
            const currentDate = new Date();

            const year = startDate.getUTCFullYear();
            const month = String(startDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(startDate.getUTCDate()).padStart(2, '0');
            const nextDueDateAlt = `${year}-${month}-${day}`;

            const requestGroupData = {
                ...taskData,
                request_type: 'recurring',
                status: 'awaiting_assignment', // Ожидает назначения исполнителя
                recurring_status: 'active',
                next_due_date: nextDueDateAlt, // Используем альтернативный способ
                date_submitted: currentDate, // Устанавливаем date_submitted для повторяющихся задач
                recurrence_type: taskData.recurrence_type
            };

            const requestGroup = await RequestGroup.create(requestGroupData, { transaction });

            // Создаем подзаявку для повторяющейся задачи
            await Request.create({
                request_group_id: requestGroup.id,
                title: taskData.title || 'Повторяющаяся задача',
                description: taskData.location_detail || 'Описание повторяющейся задачи',
                category_id: taskData.category_id || 1, // Используем первую категорию по умолчанию
                status: 'awaiting_assignment'
            }, { transaction });

            // Создаем первый экземпляр задачи
            await RecurringTaskInstance.create({
                request_group_id: requestGroup.id,
                due_date: nextDueDateAlt, // Используем альтернативный способ
                status: 'pending'
            }, { transaction });

            await transaction.commit();
            return requestGroup;
        } catch (error) {
            await rollbackAndRethrow(transaction, error);
        }
    }

        // Получение всех повторяющихся задач
    static async getAllRecurringTasks(page = 1, pageSize = 10, user = null) {
        const offset = (page - 1) * pageSize;

        const whereClause = { request_type: 'recurring' };

        // Фильтрация по роли пользователя
        if (user && user.role === 'admin-worker' && user.office_id) {
            // Для admin-worker показываем только задачи своего офиса
            whereClause.office_id = user.office_id;
        } else if (user && user.role === 'department-head' && user.office_id) {
            // Для department-head показываем задачи его отдела
            whereClause.office_id = user.office_id;
        } else if (user && user.role === 'manager') {
            // Для менеджера показываем все повторяющиеся задачи
            // (без дополнительных фильтров)
        }

        // Получаем все повторяющиеся задачи
        let { count, rows } = await RequestGroup.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: RecurringTaskInstance,
                    as: 'taskInstances',
                    separate: true,
                    limit: 5,
                    order: [['due_date', 'DESC']]
                },
                {
                    model: Request,
                    as: 'requests',
                    include: [
                        {
                            model: ServiceCategory,
                            as: 'category',
                            attributes: ['id', 'name']
                        },
                        {
                            model: RequestExecutor,
                            as: 'requestExecutors',
                            include: [
                                {
                                    model: Executor,
                                    as: 'executor',
                                    include: [
                                        {
                                            model: User,
                                            as: 'user',
                                            attributes: ['id', 'full_name', 'phone']
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: User,
                    as: 'client',
                    attributes: ['id', 'full_name', 'phone']
                },
                {
                    model: Office,
                    as: 'office',
                    attributes: ['id', 'name']
                },
                {
                    model: RequestPhoto,
                    as: 'photos',
                    attributes: ['id', 'photo_url', 'type', 'created_at']
                }
            ],
            limit: pageSize,
            offset: offset,
            order: [['created_date', 'DESC']]
        });

        return {
            tasks: rows,
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil(count / pageSize)
            }
        };
    }

    // Получение экземпляров задачи
    static async getTaskInstances(requestGroupId, page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;

        const { count, rows } = await RecurringTaskInstance.findAndCountAll({
            where: { request_group_id: requestGroupId },
            include: [
                {
                    model: User,
                    as: 'completedByUser',
                    attributes: ['id', 'full_name', 'phone']
                }
            ],
            limit: pageSize,
            offset: offset,
            order: [['due_date', 'DESC']]
        });

        return {
            instances: rows,
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil(count / pageSize)
            }
        };
    }

    // Отметка экземпляра задачи как выполненной
    static async completeTaskInstance(instanceId, userId, notes = null) {
        const instance = await RecurringTaskInstance.findByPk(instanceId);

        if (!instance) {
            throw new NotFoundError('Task instance not found');
        }

        const transaction = await sequelize.transaction();

        try {
            // Получаем основную задачу
            const requestGroup = await RequestGroup.findByPk(instance.request_group_id);
            
            if (requestGroup && requestGroup.request_type === 'recurring' && requestGroup.recurring_status === 'active') {
                // Сначала сохраняем информацию о завершении в историю
                await this.saveTaskCompletionHistory(instance, userId, notes, transaction);
                
                // Вычисляем следующую дату на основе текущей даты экземпляра
                const nextDate = this.calculateNextDueDateSync(requestGroup, instance.due_date);
                
                // Обновляем экземпляр для следующего периода (переиспользуем тот же экземпляр)
                await instance.update({
                    status: 'pending', // Ставим в ожидание до следующего дня
                    due_date: nextDate, // Обновляем дату на следующий период
                    completed_date: null, // Сбрасываем дату завершения
                    completed_by: null, // Сбрасываем исполнителя
                    notes: null, // Сбрасываем заметки
                    updated_date: new Date()
                }, { transaction });

                            // Обновляем основную задачу (временно отключаем триггер)
            await sequelize.query(
                'ALTER TABLE request_groups DISABLE TRIGGER trigger_update_recurring_task_dates;',
                { transaction }
            );
            
            await requestGroup.update({
                last_completed_date: new Date(),
                next_due_date: nextDate,
                status: 'awaiting_assignment' // Ждем назначения на следующий день
            }, { transaction });
            
            // Включаем триггер обратно
            await sequelize.query(
                'ALTER TABLE request_groups ENABLE TRIGGER trigger_update_recurring_task_dates;',
                { transaction }
            );
            } else {
                // Если задача не активна, просто отмечаем как завершенную
                await instance.update({
                    status: 'completed',
                    completed_date: new Date(),
                    completed_by: userId,
                    notes: notes,
                    updated_date: new Date()
                }, { transaction });
            }

            await transaction.commit();
            return instance;
        } catch (error) {
            await rollbackAndRethrow(transaction, error);
        }
    }

    // Сохранение истории завершения задачи
    static async saveTaskCompletionHistory(instance, userId, notes, transaction) {
        // Здесь можно создать отдельную таблицу для истории или использовать логи
        // Пока сохраняем в RequestLog
        await RequestLog.create({
            request_group_id: instance.request_group_id,
            action_type: 'task_completed',
            action_description: `Задача завершена: ${notes || 'Без комментария'}`,
            user_id: userId,
            timestamp: new Date(),
            additional_data: JSON.stringify({
                instance_id: instance.id,
                due_date: instance.due_date,
                notes: notes
            })
        }, { transaction });
    }

    // Пропуск экземпляра задачи
    static async skipTaskInstance(instanceId, userId, notes = null) {
        const instance = await RecurringTaskInstance.findByPk(instanceId);

        if (!instance) {
            throw new NotFoundError('Task instance not found');
        }

        return await instance.update({
            status: 'skipped',
            completed_by: userId,
            notes: notes,
            updated_date: new Date()
        });
    }

    // Приостановка/возобновление повторяющейся задачи
    static async toggleRecurringTask(requestGroupId, action) {
        const requestGroup = await RequestGroup.findByPk(requestGroupId);

        if (!requestGroup) {
            throw new NotFoundError('Request group not found');
        }

        let newStatus;
        let newRecurringStatus;

        if (action === 'pause') {
            newStatus = 'awaiting_assignment';
            newRecurringStatus = 'paused';
        } else if (action === 'resume') {
            newStatus = 'awaiting_assignment';
            newRecurringStatus = 'active';
        } else {
            throw new BadRequestError('Invalid action');
        }

        return await requestGroup.update({
            status: newStatus,
            recurring_status: newRecurringStatus
        });
    }

    // Обновление статуса повторяющейся задачи
    static async updateRecurringTaskStatus(requestGroupId, recurringStatus) {
        const requestGroup = await RequestGroup.findByPk(requestGroupId);

        if (!requestGroup || requestGroup.request_type !== 'recurring') {
            throw new NotFoundError('Recurring task not found');
        }

        const validStatuses = ['active', 'paused', 'completed'];
        if (!validStatuses.includes(recurringStatus)) {
            throw new BadRequestError('Invalid recurring status');
        }

        return await requestGroup.update({ recurring_status: recurringStatus });
    }

    // Получение статистики повторяющейся задачи
    static async getTaskStats(requestGroupId) {
        const result = await sequelize.query(
            'SELECT * FROM get_recurring_task_stats(:requestGroupId)',
            {
                replacements: { requestGroupId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        return result[0] || {
            total_instances: 0,
            completed_instances: 0,
            pending_instances: 0,
            overdue_instances: 0,
            completion_rate: 0
        };
    }

    // Получение предстоящих задач
    static async getUpcomingTasks(userId, limit = 10) {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Получаем информацию о пользователе
        const user = await User.findByPk(userId);
        if (!user) {
            return [];
        }

        let whereClause = {
            due_date: {
                [Op.between]: [today, nextWeek]
            },
            status: 'pending'
        };

        // Добавляем фильтрацию по офису для department-head
        let requestGroupWhere = { request_type: 'recurring' };
        if (user.role === 'department-head' && user.office_id) {
            requestGroupWhere.office_id = user.office_id;
        }

        let instances = await RecurringTaskInstance.findAll({
            where: whereClause,
            include: [
                {
                    model: RequestGroup,
                    as: 'requestGroup',
                    where: requestGroupWhere,
                    include: [
                        {
                            model: User,
                            as: 'client',
                            attributes: ['id', 'full_name', 'phone']
                        },
                        {
                            model: Request,
                            as: 'requests',
                            include: [
                                {
                                    model: ServiceCategory,
                                    as: 'category',
                                    attributes: ['id', 'name']
                                }
                            ]
                        }
                    ]
                }
            ],
            limit: limit,
            order: [['due_date', 'ASC']]
        });

        return instances;
    }




    static async reconcileAndCreateAll() {
        const today = toDateOnlyLocal(); // строка 'YYYY-MM-DD'

        return sequelize.transaction(async (t) => {
            const tasks = await RequestGroup.findAll({
                where: { request_type: 'recurring', recurring_status: 'active' },
                transaction: t
            });

            let totalCreated = 0;

            for (const task of tasks) {
                const intervalDays = toIntervalDays(task.recurrence_type, task.recurrence_interval);

                // 1) Ищем текущий pending по группе (самый ранний)
                const pending = await RecurringTaskInstance.findOne({
                    where: { request_group_id: task.id, status: 'pending' },
                    order: [['due_date', 'ASC']],
                    transaction: t
                });

                // 2) Если есть pending и его срок ещё не наступил (или сегодня) — НИЧЕГО не создаём
                if (pending && pending.due_date >= today) {
                    // поддержим next_due_date на дату текущего pending
                    if (task.next_due_date !== pending.due_date) {
                        await task.update({ next_due_date: pending.due_date }, { transaction: t });
                    }
                    continue;
                }

                // 3) Если pending просрочен — помечаем как skipped
                if (pending && pending.due_date < today) {
                    await pending.update({ status: 'skipped' }, { transaction: t });
                }

                // 4) Рассчитываем следующую дату, начиная от next_due_date или (если её нет) от today
                let base = today;
                while (base < today) {
                    base = addDaysOnlyLocal(base, intervalDays);
                }
                const nextDue = base; // это ближайшая будущая/сегодняшняя дата для новой задачи

                // 5) Создаём новый pending только если его ещё нет на эту дату
                const [, created] = await RecurringTaskInstance.findOrCreate({
                    where: { request_group_id: task.id, due_date: nextDue }, // ВАЖНО: due_date как строка
                    defaults: { status: 'pending' },
                    transaction: t
                });

                if (created) totalCreated++;

                // 6) Обновляем next_due_date на ту же дату (текущая активная)
                // Если хочешь хранить «следующую после текущей», поставь addDaysOnlyLocal(nextDue, intervalDays)
                await task.update({ next_due_date: nextDue }, { transaction: t });
            }

            return totalCreated;
        });
    }


    // Получение повторяющейся задачи по ID
    static async getRecurringTaskById(requestGroupId) {
        const task = await RequestGroup.findOne({
            where: {
                id: requestGroupId,
                request_type: 'recurring'
            },
            include: [
                {
                    model: RecurringTaskInstance,
                    as: 'taskInstances',
                    separate: true,
                    limit: 10,
                    order: [['due_date', 'DESC']],
                    include: [
                        {
                            model: User,
                            as: 'completedByUser',
                            attributes: ['id', 'full_name', 'phone']
                        }
                    ]
                }
            ]
        });
        if (!task) {
            throw new NotFoundError('Recurring task not found');
        }
        return task;
    }

    // Обновление повторяющейся задачи
    static async updateRecurringTask(requestGroupId, updateData) {
        const requestGroup = await RequestGroup.findByPk(requestGroupId);

        if (!requestGroup || requestGroup.request_type !== 'recurring') {
            throw new NotFoundError('Recurring task not found');
        }

        return await requestGroup.update(updateData);
    }

    // Удаление повторяющейся задачи
    static async deleteRecurringTask(requestGroupId) {
        const requestGroup = await RequestGroup.findByPk(requestGroupId);

        if (!requestGroup || requestGroup.request_type !== 'recurring') {
            throw new NotFoundError('Recurring task not found');
        }

        await requestGroup.destroy();
    }

    // Получение календаря повторяющихся задач
    static async getRecurringTaskCalendar(userId, startDate, endDate) {
        // Получаем информацию о пользователе
        const user = await User.findByPk(userId);
        if (!user) {
            return [];
        }

        let requestGroupWhere = { request_type: 'recurring' };
        if (user.role === 'department-head' && user.office_id) {
            requestGroupWhere.office_id = user.office_id;
        }

        let instances = await RecurringTaskInstance.findAll({
            where: {
                due_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            include: [
                {
                    model: RequestGroup,
                    as: 'requestGroup',
                    where: requestGroupWhere,
                    include: [
                        {
                            model: User,
                            as: 'client',
                            attributes: ['id', 'full_name', 'phone']
                        },
                        {
                            model: Request,
                            as: 'requests',
                            include: [
                                {
                                    model: ServiceCategory,
                                    as: 'category',
                                    attributes: ['id', 'name']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['due_date', 'ASC']]
        });

        return instances;
    }

    // Назначение исполнителя для повторяющейся задачи
    static async assignExecutor(requestGroupId, executorId) {
        const transaction = await sequelize.transaction();
        
        try {
            const requestGroup = await RequestGroup.findByPk(requestGroupId, {
                include: [
                    {
                        model: Request,
                        as: 'requests'
                    }
                ],
                transaction
            });
            
            if (!requestGroup || requestGroup.request_type !== 'recurring') {
                throw new NotFoundError('Recurring task not found');
            }

            if (requestGroup.recurring_status !== 'active') {
                throw new BadRequestError('Task is not active');
            }

            // Обновляем статус группы заявок на assigned
            await requestGroup.update({
                status: 'assigned'
            }, { transaction });

        // Назначаем исполнителя к первой подзаявке (если есть)
        if (requestGroup.requests && requestGroup.requests.length > 0) {
            const firstRequest = requestGroup.requests[0];
            
            // Проверяем, что подзаявка в статусе awaiting_assignment
            if (firstRequest.status !== 'awaiting_assignment') {
                throw new BadRequestError('Request is not in awaiting_assignment status');
            }
            
            // Проверяем, что исполнитель существует
            const executor = await Executor.findByPk(executorId, { transaction });
            if (!executor) {
                throw new NotFoundError('Executor not found');
            }
            
            // Удаляем старые назначения для этой подзаявки
            await RequestExecutor.destroy({
                where: { request_id: firstRequest.id },
                transaction
            });

            // Создаем новое назначение
            await RequestExecutor.create({
                request_id: firstRequest.id,
                executor_id: executorId,
                role: 'leader' // Назначаем как лидера для повторяющихся задач
            }, { transaction });

            // Обновляем статус подзаявки на assigned
            await firstRequest.update({
                status: 'assigned'
            }, { transaction });
        } else {
            throw new NotFoundError('No requests found in recurring task group');
        }

        await transaction.commit();
        return requestGroup;
        } catch (error) {
            await rollbackAndRethrow(transaction, error);
        }
    }

    // Изменение исполнителя для повторяющейся задачи
    static async changeExecutor(requestGroupId, newExecutorId) {
        const transaction = await sequelize.transaction();
        
        try {
            const requestGroup = await RequestGroup.findByPk(requestGroupId, {
                include: [
                    {
                        model: Request,
                        as: 'requests'
                    }
                ],
                transaction
            });
            
            if (!requestGroup || requestGroup.request_type !== 'recurring') {
                throw new NotFoundError('Recurring task not found');
            }

            // Назначаем исполнителя к первой подзаявке (если есть)
            if (requestGroup.requests && requestGroup.requests.length > 0) {
                const firstRequest = requestGroup.requests[0];
                
                // Проверяем, что исполнитель существует
                const executor = await Executor.findByPk(newExecutorId, { transaction });
                if (!executor) {
                    throw new NotFoundError('Executor not found');
                }
                
                // Удаляем старые назначения для этой подзаявки
                await RequestExecutor.destroy({
                    where: { request_id: firstRequest.id },
                    transaction
                });

                // Создаем новое назначение
                await RequestExecutor.create({
                    request_id: firstRequest.id,
                    executor_id: newExecutorId,
                    role: 'leader' // Назначаем как лидера для повторяющихся задач
                }, { transaction });
            } else {
                throw new NotFoundError('No requests found in recurring task group');
            }

            await transaction.commit();
            return requestGroup;
        } catch (error) {
            await rollbackAndRethrow(transaction, error);
        }
    }


    // Вычисление следующей даты для повторяющейся задачи (синхронная версия)
    static calculateNextDueDateSync(requestGroup, fromDate = null) {
        const currentDate = fromDate || new Date();
        const { recurrence_type, recurrence_interval } = requestGroup;
        
        let nextDate = new Date(currentDate);
        
        switch (recurrence_type) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + recurrence_interval);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + (recurrence_interval * 7));
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + recurrence_interval);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + recurrence_interval);
                break;
            default:
                nextDate.setDate(nextDate.getDate() + 1); // По умолчанию ежедневно
        }
        
        return nextDate;
    }

    // Автоматическое создание экземпляров задач
    static async createTaskInstances() {
        logger.debug('RecurringTaskService: createTaskInstances started');

        const activeTasks = await RequestGroup.findAll({
            where: {
                request_type: 'recurring',
                recurring_status: 'active'
            },
            attributes: ['id', 'recurrence_type', 'recurrence_interval', 'next_due_date']
        });
        
        logger.debug('RecurringTaskService: active recurring tasks', { count: activeTasks.length });

        await sequelize.query('SELECT create_recurring_task_instances()');
        
        // Активируем задачи на сегодня (только те, которые должны быть активны сегодня)
        await this.activatePendingTasks();
    }


    // Активация задач на следующий день
    static async activatePendingTasks() {
        logger.debug('RecurringTaskService: activatePendingTasks started');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Находим все задачи в статусе 'pending' с датой выполнения сегодня
        const pendingInstances = await RecurringTaskInstance.findAll({
            where: {
                status: 'pending',
                due_date: {
                    [Op.gte]: today,
                    [Op.lt]: new Date(today.getTime() + 24 * 60 * 60 * 1000) // До конца дня
                }
            },
            include: [{
                model: RequestGroup,
                as: 'requestGroup',
                where: {
                    request_type: 'recurring',
                    recurring_status: 'active'
                },
                include: [
                    {
                        model: Request,
                        as: 'requests',
                        where: {
                            status: 'completed'
                        },
                        required: false,
                    }
                ]
            }]
        });
        
        logger.debug('RecurringTaskService: pending instances', { count: pendingInstances.length });

        for (const instance of pendingInstances) {

            
            try {
                await instance.requestGroup.update({
                    date_submitted: new Date()
                })
                await instance.requestGroup.requests[0].update({
                    status: 'assigned',
                    updated_date: new Date()
                });
                
                logger.debug('RecurringTaskService: activated instance', { instanceId: instance.id, dueDate: instance.due_date });
            } finally {
                // ensure block not empty
            }
        }
        
        }

    static async createInstancesForTask(taskId) {
        const task = await RequestGroup.findByPk(taskId);
        if (!task || task.request_type !== 'recurring') {
            throw new NotFoundError('Task not found or not a recurring task');
        }
        
        // Вычисляем интервал в днях
        let intervalDays;
        switch (task.recurrence_type) {
            case 'daily':
                intervalDays = task.recurrence_interval;
                break;
            case 'weekly':
                intervalDays = task.recurrence_interval * 7;
                break;
            case 'monthly':
                intervalDays = task.recurrence_interval * 30;
                break;
            case 'yearly':
                intervalDays = task.recurrence_interval * 365;
                break;
            default:
                throw new BadRequestError('Invalid recurrence type');
        }
        
        logger.debug('RecurringTaskService: interval days', { intervalDays });
        
        // Создаем экземпляры на следующие 30 дней
        const startDate = task.next_due_date || new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        
        let currentDate = new Date(startDate);
        let instancesCreated = 0;
        
        while (currentDate <= endDate) {
            // Проверяем, не существует ли уже экземпляр для этой даты
            const existingInstance = await RecurringTaskInstance.findOne({
                where: {
                    request_group_id: task.id,
                    due_date: currentDate
                }
            });
            
            if (!existingInstance) {
                await RecurringTaskInstance.create({
                    request_group_id: task.id,
                    due_date: currentDate,
                    status: 'pending'
                });
                instancesCreated++;
                logger.debug('RecurringTaskService: created instance', { dueDate: currentDate });
            }
            
            // Переходим к следующей дате
            currentDate.setDate(currentDate.getDate() + intervalDays);
        }
        
        // Обновляем следующую дату выполнения
        await task.update({
            next_due_date: currentDate
        });
        
        logger.debug('RecurringTaskService: instances created', { count: instancesCreated });
        return instancesCreated;
    }



    // Импорт повторяющихся задач через Excel
    static async importRecurringTasksFromExcel(file, user) {
        const workbook = new ExcelJS.Workbook();
        const errors = [];
        let successCount = 0;
        let skippedCount = 0;

        try {
            // Читаем файл Excel
            await workbook.xlsx.readFile(file.path);

            // Получаем первый лист
            const worksheet = workbook.getWorksheet(1);
            if (!worksheet) {
                throw new BadRequestError('No worksheet found in Excel file');
            }

            // Получаем заголовки (первая строка)
            const headers = [];
            worksheet.getRow(1).eachCell((cell, colNumber) => {
                headers[colNumber] = cell.value?.toString().toLowerCase().trim();
            });

            // Проверяем обязательные заголовки
            const requiredHeaders = ['название', 'описание', 'локация', 'категория', 'тип_повторения', 'интервал', 'дата_начала'];
            const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
            
            if (missingHeaders.length > 0) {
                throw new BadRequestError(`Missing required headers: ${missingHeaders.join(', ')}`);
            }

            // Получаем все категории для валидации
            const categoryWhere = user.office_id
              ? { office_id: user.office_id }
              : {};
            const categories = await ServiceCategory.findAll({ where: categoryWhere });
            const categoryMap = new Map(categories.map(cat => [cat.name.toLowerCase(), cat.id]));

            // Обрабатываем каждую строку данных (начиная со второй строки)
            for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);
                const rowData = {};

                // Извлекаем данные из ячеек
                headers.forEach((header, colNumber) => {
                    const cell = row.getCell(colNumber);
                    rowData[header] = cell.value?.toString().trim() || '';
                });

                // Пропускаем пустые строки
                if (!rowData['название'] && !rowData['описание'] && !rowData['локация']) {
                    skippedCount++;
                    continue;
                }

                try {
                    // Валидация данных
                    const validationErrors = this.validateRecurringTaskData(rowData, categoryMap);
                    if (validationErrors.length > 0) {
                        errors.push({
                            row: rowNumber,
                            errors: validationErrors
                        });
                        continue;
                    }

                    // Подготавливаем данные для создания задачи
                    const taskData = {
                        title: rowData['название'],
                        location: rowData['локация'],
                        location_detail: rowData['описание'] || '',
                        category_id: categoryMap.get(rowData['категория'].toLowerCase()),
                        recurrence_type: rowData['тип_повторения'].toLowerCase(),
                        recurrence_interval: parseInt(rowData['интервал']) || 1,
                        start_date: new Date(rowData['дата_начала']),
                        client_id: user.role === 'admin-worker' ? user.id : null,
                        office_id: user.role === 'department-head' && user.office_id ? user.office_id : null
                    };

                    // Создаем повторяющуюся задачу
                    await this.createRecurringTask(taskData);
                    successCount++;

                } catch (error) {
                    errors.push({
                        row: rowNumber,
                        errors: [error.message]
                    });
                }
            }

            // Удаляем временный файл
            fs.unlinkSync(file.path);

            return {
                successCount,
                skippedCount,
                errorCount: errors.length,
                errors: errors.slice(0, 10) // Возвращаем только первые 10 ошибок
            };

        } catch (error) {
            // Удаляем временный файл в случае ошибки
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            throw error;
        }
    }

    // Валидация данных повторяющейся задачи
    static validateRecurringTaskData(data, categoryMap) {
        const errors = [];

        // Проверяем обязательные поля
        if (!data['название'] || data['название'].length < 3) {
            errors.push('Название должно содержать минимум 3 символа');
        }

        if (!data['локация'] || data['локация'].length < 3) {
            errors.push('Локация должна содержать минимум 3 символа');
        }

        if (!data['категория']) {
            errors.push('Категория обязательна');
        } else if (!categoryMap.has(data['категория'].toLowerCase())) {
            errors.push(`Категория "${data['категория']}" не найдена`);
        }

        // Проверяем тип повторения
        const validRecurrenceTypes = ['daily', 'weekly', 'monthly', 'yearly'];
        if (!data['тип_повторения'] || !validRecurrenceTypes.includes(data['тип_повторения'].toLowerCase())) {
            errors.push('Тип повторения должен быть одним из: daily, weekly, monthly, yearly');
        }

        // Проверяем интервал
        const interval = parseInt(data['интервал']);
        if (isNaN(interval) || interval < 1 || interval > 365) {
            errors.push('Интервал должен быть числом от 1 до 365');
        }

        // Проверяем дату начала
        const startDate = new Date(data['дата_начала']);
        if (isNaN(startDate.getTime())) {
            errors.push('Неверный формат даты начала');
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (startDate < today) {
                errors.push('Дата начала не может быть в прошлом');
            }
        }

        return errors;
    }
}

export default RecurringTaskService;
