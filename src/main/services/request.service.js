import { Executor, Request, RequestExecutor, RequestGroup, RequestPhoto, ServiceCategory, User, RecurringTaskInstance } from '../models/init.model.js';
import NotificationService from './notification.service.js';
import notificationService from './notification.service.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import { Op } from 'sequelize';
import RequestLogger from '../utils/requestLogger.js';
import RequestExecutorService from './requestExecutor.service.js';
import { sequelize } from '../config/database.config.js';
import RequestGroupService from './requestGroup.service.js';
import RecurringTaskService from './recurringTask.service.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import logger from '../utils/winston/logger.js';

class RequestService {
  static async getAllRequests(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;

    const { count, rows } = await Request.findAndCountAll({
      offset,
      limit: pageSize,
      include: [
        {
          model: RequestGroup,
          as: 'requestGroup',
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'full_name']
            },
            {
              model: RequestPhoto,
              as: 'photos'
            }
          ]
        },
        {
          model: Executor,
          as: 'executors',
          attributes: ['id', 'specialty'],
          through: { attributes: ['role'] },
          include: [
            { model: User, as: 'user', attributes: ['id', 'full_name','phone'] }
          ]
        },
        { model: ServiceCategory, as: 'category' }
      ],
      order: [['created_date', 'DESC']]
    });

    return {
      total: count,
      totalPages: Math.ceil(count / pageSize),
      page,
      pageSize,
      data: rows
    };
  }

  static async getRequestsByUser(userId, page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;

    return await Request.findAndCountAll({
      include: [
        {
          model: RequestGroup,
          as: 'requestGroup',
          where: { client_id: userId },
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'full_name','phone']
            },
            {
              model: RequestPhoto,
              as: 'photos'
            }
          ]
        },
        {
          model: Executor,
          as: 'executors',
          attributes: ['id', 'specialty'],
          through: { attributes: ['role'] },
          include: [
            { model: User, as: 'user', attributes: ['id', 'full_name'] }
          ]
        },
        { model: ServiceCategory, as: 'category' }
      ],
      limit: pageSize,
      offset,
      order: [['created_date', 'DESC']]
    });
  }

  static async getAdminWorkerRequests(id, page = 1, pageSize = 10) {
    const user = await User.findByPk(id);

    const offset = (page - 1) * pageSize;

    const { count, rows } = await Request.findAndCountAll({
      include: [
        {
          model: RequestGroup,
          as: 'requestGroup',
          where: { office_id: user.office_id },
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'full_name']
            },
            {
              model: RequestPhoto,
              as: 'photos'
            }
          ]
        },
        { model: ServiceCategory, as: 'category' },
        {
          model: Executor,
          as: 'executors',
          attributes: ['id', 'specialty'],
          through: { attributes: ['role'] },
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'full_name']
            }
          ]
        }
      ],
      order: [['created_date', 'DESC']],
      limit: pageSize,
      offset
    });

    // Разделяем на мои заявки и заявки других пользователей
    const myRequests = rows.filter(req => req.requestGroup?.client_id === id);
    const otherRequests = rows.filter(req => req.requestGroup?.client_id !== id);

    return {
      myRequests,
      otherRequests,
      total: count,
      page,
      pageSize
    };
  }

  static async getDepartmentHeadRequests(userId) {
    const user = await User.findByPk(userId);

    const allRequests = await Request.findAll({
      where: {
        [Op.and]: [
          { category_id: user.service_category_id },
          {
            [Op.or]: [
              { status: 'awaiting_assignment' },
              // Для личных заявок пользователя нужно проверить через requestGroup
              { '$requestGroup.client_id$': userId }
            ]
          }
        ]
      },
      include: [
        {
          model: RequestGroup,
          as: 'requestGroup',
          where: { office_id: user.office_id },
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'full_name', 'phone']
            },
            {
              model: RequestPhoto,
              as: 'photos'
            }
          ]
        },
        { model: ServiceCategory, as: 'category' },
        {
          model: Executor,
          as: 'executors',
          attributes: ['id', 'specialty'],
          through: { attributes: ['role'] },
          include: [
            { model: User, as: 'user', attributes: ['id', 'full_name'] }
          ]
        }
      ]
    });
    
    const myRequests = allRequests.filter(req => req.requestGroup?.client_id === userId);
    const otherRequests = allRequests.filter(req => req.requestGroup?.client_id !== userId);

    return { myRequests, otherRequests };
  }

  static async getExecutorRequests(userId) {
    const executor = await Executor.findOne({
      where: { user_id: userId }
    });
    
    if (!executor) {
      throw new NotFoundError(`Executor not found for user ${userId}`);
    }

    const allRequests = await Request.findAll({
      where: {
        [Op.or]: [
          // Заявки где пользователь является исполнителем
          { '$executors.id$': executor.id },
          // Заявки созданные самим пользователем
          { '$requestGroup.client_id$': userId }
        ]
      },
      include: [
        {
          model: RequestGroup,
          as: 'requestGroup',
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'full_name', 'phone']
            },
            {
              model: RequestPhoto,
              as: 'photos'
            }
          ]
        },
        { model: ServiceCategory, as: 'category' },
        {
          model: Executor,
          as: 'executors',
          attributes: ['id', 'specialty'],
          through: { attributes: ['role'] },
          include: [
            { model: User, as: 'user', attributes: ['id', 'full_name'] }
          ]
        }
      ],
      order: [['created_date', 'DESC']]
    });
    
    const myRequests = allRequests.filter(req => req.requestGroup?.client_id === userId);
    const assignedRequests = allRequests.filter(req => req.status !== 'completed' && req.requestGroup?.client_id !== userId);
    const completedRequests = allRequests.filter(req => req.status === 'completed' && req.requestGroup?.client_id !== userId);

    return { assignedRequests, completedRequests, myRequests };
  }

  static async getRequestById(id) {
    return await Request.findByPk(id, {
      include: [
        { model: RequestPhoto, as: "photos" },
        {
          model: RequestGroup,
          as: 'requestGroup',
          include: [
            {
              model: User,
              as: 'client',
              attributes: ['id', 'full_name']
            }
          ]
        },
        {
          model: Executor,
          as: 'executors',
          attributes: ['id', 'specialty'],
          through: { attributes: ['status', 'assigned_date', 'completion_date'] },
          include: [
            { model: User, as: 'user', attributes: ['id', 'full_name','phone'] }
          ]
        },
        { model: ServiceCategory, as: 'category' }
      ]
    });
  }

  static async createRequest(requestGroupId, subRequests, transaction = null) {
    for (let i = 0; i < subRequests.length; i++) {
      const subReq = subRequests[i];
      const request = await Request.create({
        request_group_id: requestGroupId,
        title: subReq.title,
        description: subReq.description,
        status: subReq.status,
        category_id: subReq.category_id,
        subcategory_id: subReq.subcategory_id ?? null,
        complexity: subReq?.complexity ? subReq?.complexity : null,
        sla: subReq?.sla ? subReq.sla : null,
        planned_date: subReq?.planned_date ? subReq.planned_date : null,
        comment: subReq?.comment ? subReq.comment : null,
        sub_request_number: i + 1,
      }, { transaction });

      // Если есть исполнители, назначаем их
      if (subReq?.executors && subReq.executors.length > 0) {
        await RequestExecutorService.assignExecutorsToRequestWhenCreateRequest(request.id, subReq.executors, transaction);
      }
    }
  }

  static async updateRequest(id, updateData) {
    if (updateData?.patch_code === 1) {
      return await this.rejectToReAssignExecutor(id, updateData);
    } else {
      throw new BadRequestError("Undefined patch_code");
    }
  }

  static async rejectToReAssignExecutor(request_id, updateData) {
    const tx = await sequelize.transaction();
    try {
      const request = await Request.findByPk(request_id, {
        include: [{ model: RequestGroup, as: 'requestGroup' }],
        transaction: tx
      });
      if (['completed', 'in_progress', 'awaiting_assignment'].includes(request.status)) {
        throw new BadRequestError("Unable to reject assignment");
      }
      if (updateData.status !== "awaiting_assignment") {
        throw new BadRequestError("Unable to reject assignment");
      }
      await request.update(updateData, {transaction: tx});
      await RequestExecutor.destroy({
        where: { request_id },
        transaction: tx
      });

      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async deleteRequest(id) {
    const tx = await sequelize.transaction();
    try {
      const request = await Request.findByPk(id, {
        include: [{ model: RequestGroup, as: 'requestGroup' }],
        transaction: tx
      });
      if (!request) {
        throw new NotFoundError('Request not found');
      }
      await Request.destroy({ where: { id }, transaction: tx });
      await RequestGroupService.updateRequestGroupStatus(request?.requestGroup?.id, tx);

      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async startRequest(requestId, userId, req = null) {
    let request;
    const tx = await sequelize.transaction();

    try {
      request = await Request.findByPk(requestId, {
        include: [
          {
            model: RequestExecutor,
            as: 'requestExecutors',
            include: [{ model: Executor, as: 'executor' }]
          },
          {model: RequestGroup, as: 'requestGroup'}
        ], transaction: tx
      });
      if (!request) {
        throw new NotFoundError('Request not found');
      }
      if (request.status !== 'assigned') {
        throw new ForbiddenError("Not available for start request");
      }
      const isLeader = request.requestExecutors.some(
          (reqExecutor) => reqExecutor.executor.user_id === userId && reqExecutor.role === 'leader'
      );

      if (!isLeader) {
        throw new ForbiddenError('Forbidden');
      }

      request.status = 'execution';
      request.date_submitted = Date.now();

      await request.save({transaction: tx});
      await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);
      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }

    Promise.resolve(
      RequestLogger.logRequestStarted(
        request.id,
        userId,
        req ? RequestLogger.getIpAddress(req) : null,
        req ? RequestLogger.getUserAgent(req) : null
      )
    ).catch(err => logger.error('Ошибка при логировании начала заявки', { error: err?.message }));

    Promise.resolve(
      NotificationService.sendNotification({
        userId: request.requestGroup.client_id,
        request: request,
        type: 'start_request'
      })
    ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));

    return request;
  }

  static async finishRequest(requestId, userId, req = null) {
    let request;
    const tx = await sequelize.transaction();

    try {
      request = await Request.findByPk(requestId, {
        include: [
          {
            model: RequestExecutor,
            as: 'requestExecutors',
            include: [{ model: Executor, as: 'executor' }]
          },
          {model: RequestGroup, as: 'requestGroup'}
        ], transaction: tx
      });
      if (!request) {
        throw new NotFoundError('Request not found');
      }
      if (request.status !== 'execution') {
        throw new ForbiddenError("Not available for complete request");
      }
      const isLeader = request.requestExecutors.some(
          (reqExecutor) => reqExecutor.executor.user_id === userId && reqExecutor.role === 'leader'
      );

      if (!isLeader) {
        throw new ForbiddenError('Forbidden');
      }

      request.status = 'completed';
      request.actual_completion_date = new Date();
      request.comment = req.body.comment;

      await request.save({transaction: tx});
      await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);

      // Проверяем, является ли это повторяющейся задачей
      if (request.requestGroup && request.requestGroup.request_type === 'recurring' && request.requestGroup.recurring_status === 'active') {
        // Находим активный экземпляр повторяющейся задачи
        const activeInstance = await RecurringTaskInstance.findOne({
          where: {
            request_group_id: request.requestGroup.id,
            status: 'pending'
          },
          order: [['due_date', 'ASC']],
          transaction: tx
        });

        if (activeInstance) {
          // Завершаем текущий экземпляр
          await activeInstance.update({
            status: 'completed',
            completed_date: new Date(),
            completed_by: userId,
            notes: req.body.comment,
            updated_date: new Date()
          }, { transaction: tx });

          // Вычисляем следующую дату
          const nextDate = RecurringTaskService.calculateNextDueDateSync(request.requestGroup);
          
          // Создаем новый экземпляр для следующего периода
          await RecurringTaskInstance.create({
            request_group_id: request.requestGroup.id,
            due_date: nextDate,
            status: 'pending'
          }, { transaction: tx });

          // Обновляем основную задачу
          await request.requestGroup.update({
            last_completed_date: new Date(),
            next_due_date: nextDate,
            status: 'assigned' // Готово к выполнению
          }, { transaction: tx });
        }
      }

      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }

    Promise.resolve(
      RequestLogger.logRequestCompleted(
        request.id,
        userId,
        req.body.comment,
        req ? RequestLogger.getIpAddress(req) : null,
        req ? RequestLogger.getUserAgent(req) : null
      )
    ).catch(err => logger.error('Ошибка при логировании завершения заявки', { error: err?.message }));

    Promise.resolve(
      NotificationService.sendNotification({
        userId: request.requestGroup.client_id,
        request: request,
        type: 'end_request',
        completedByUserId: userId,
      })
    ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));

    return request;
  }

  /**
   * Admin can complete a request directly without going through the normal workflow.
   * Allows completing from 'in_progress' or 'awaiting_assignment' status.
   */
  static async adminCompleteRequest(requestId, userId, req = null) {
    let request;
    const tx = await sequelize.transaction();

    try {
      const actor = await User.findByPk(userId, {
        attributes: ['id', 'role', 'office_id'],
        transaction: tx,
      });
      if (!actor) {
        throw new NotFoundError('User not found');
      }
      if (!['admin-worker', 'department-head'].includes(actor.role)) {
        throw new ForbiddenError('Forbidden');
      }

      request = await Request.findByPk(requestId, {
        include: [
          { model: RequestGroup, as: 'requestGroup' }
        ], transaction: tx
      });

      if (!request) {
        throw new NotFoundError('Request not found');
      }

      if (actor.role === 'department-head') {
        if (
          !request.requestGroup ||
          actor.office_id == null ||
          Number(request.requestGroup.office_id) !== Number(actor.office_id)
        ) {
          throw new ForbiddenError('Forbidden');
        }
      }

      // Allow completing from 'in_progress' or 'awaiting_assignment' status
      const allowedStatuses = ['in_progress', 'awaiting_assignment', 'assigned'];
      if (!allowedStatuses.includes(request.status)) {
        throw new ForbiddenError(`Cannot complete request with status: ${request.status}. Only allowed from: ${allowedStatuses.join(', ')}`);
      }

      // Update request status
      request.status = 'completed';
      request.actual_completion_date = new Date();
      if (req?.body?.comment) {
        request.comment = req.body.comment;
      }

      await request.save({ transaction: tx });
      await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);

      // Handle recurring tasks
      if (request.requestGroup && request.requestGroup.request_type === 'recurring' && request.requestGroup.recurring_status === 'active') {
        const activeInstance = await RecurringTaskInstance.findOne({
          where: {
            request_group_id: request.requestGroup.id,
            status: 'pending'
          },
          order: [['due_date', 'ASC']],
          transaction: tx
        });

        if (activeInstance) {
          await activeInstance.update({
            status: 'completed',
            completed_date: new Date(),
            completed_by: userId,
            notes: req?.body?.comment,
            updated_date: new Date()
          }, { transaction: tx });

          const nextDate = RecurringTaskService.calculateNextDueDateSync(request.requestGroup);

          await RecurringTaskInstance.create({
            request_group_id: request.requestGroup.id,
            due_date: nextDate,
            status: 'pending'
          }, { transaction: tx });

          await request.requestGroup.update({
            last_completed_date: new Date(),
            next_due_date: nextDate,
            status: 'assigned'
          }, { transaction: tx });
        }
      }

      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }

    Promise.resolve(
      RequestLogger.logRequestCompleted(
        request.id,
        userId,
        req?.body?.comment,
        req ? RequestLogger.getIpAddress(req) : null,
        req ? RequestLogger.getUserAgent(req) : null
      )
    ).catch(err => logger.error('Ошибка при логировании завершения заявки', { error: err?.message }));

    Promise.resolve(
      NotificationService.sendNotification({
        userId: request.requestGroup.client_id,
        request: request,
        type: 'end_request',
        completedByUserId: userId,
      })
    ).catch(err => logger.error('Ошибка при отправке уведомления', { error: err?.message }));

    return request;
  }

  static async findByFilters(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      logger.debug('RequestService.findByFilters: empty filters, returning all records');
    }
    return Request.findAll({ where: filters });
  }

  static async updateLongTermStatus(requestId, isLongTerm, user, req = null) {
    const request = await Request.findByPk(requestId, {
      include: [{ model: RequestGroup, as: 'requestGroup' }]
    });
    if (!request) {
      throw new NotFoundError('Request not found');
    }
    
    // Проверяем, что заявка не является частью повторяющейся задачи
    if (request.requestGroup && request.requestGroup.request_type === 'recurring') {
      throw new ForbiddenError('Long term status cannot be changed for recurring tasks');
    }
    
    if (request.status === 'completed') {
      throw new ForbiddenError('Not available for set long term');
    }
    
    request.is_long_term = isLongTerm;
    await request.save();
    
    // Логируем изменение флага долгосрочной заявки
    Promise.resolve(
      RequestLogger.logLongTermToggled(
        request.id,
        user.id,
        isLongTerm,
        req ? RequestLogger.getIpAddress(req) : null,
        req ? RequestLogger.getUserAgent(req) : null
      )
    ).catch(err => logger.error('Ошибка при логировании изменения флага долгосрочной заявки', { error: err?.message }));
    
    return request;
  }

  static async patchRequest(requestId, updateData, user, req = null) {
    const tx = await sequelize.transaction();
    let newRequest;
    let request;
    let oldData;
    try {
      // Проверяем существование заявки
      request = await Request.findByPk(requestId, {
        include: [{ model: RequestGroup, as: 'requestGroup' }],
        transaction: tx
      });
      if (!request) {
        throw new NotFoundError('Request not found');
      }
      
      // Сохраняем старые данные для логирования
      oldData = request.toJSON();
      
      if (updateData?.patch_code === 1) {
        if (updateData.status !== 'awaiting_assignment') {
          throw new BadRequestError('cant update request');
        }
        await this.handleRedirectRequest(requestId, updateData, user, req);
        newRequest = await request.update(updateData, { transaction: tx });
        await RequestExecutor.destroy({
          where: { request_id: requestId },
          transaction: tx
        });

        await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);
      } else if (updateData?.patch_code === 3) {
        // Новый patch_code для обновления SLA и сложности админом
        if (user.role !== 'admin-worker') {
          throw new ForbiddenError('Only admin-worker can update SLA and complexity');
        }
        
        // Разрешаем обновление только SLA и сложности
        const allowedFields = ['sla', 'complexity'];
        const filteredUpdateData = {};
        
        allowedFields.forEach(field => {
          if (updateData[field] !== undefined) {
            filteredUpdateData[field] = updateData[field];
          }
        });
        
        if (Object.keys(filteredUpdateData).length === 0) {
          throw new BadRequestError('No valid fields to update');
        }
        
        newRequest = await request.update(filteredUpdateData, { transaction: tx });
        
        // Обновляем статус группы заявок если нужно
        if (request.requestGroup) {
          await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);
        }
      } else {
        throw new BadRequestError("Incorrect patch_code");
      }
      
      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }

    Promise.resolve(
      RequestLogger.logRequestUpdated(
        request.requestGroup.id,
        user.id,
        oldData,
        newRequest.toJSON(),
        req ? RequestLogger.getIpAddress(req) : null,
        req ? RequestLogger.getUserAgent(req) : null
      )
    ).catch(err => logger.error('Ошибка при логировании обновления заявки', { error: err?.message }));

    return newRequest;
  }

  static async handleRedirectRequest(requestId, updateData, user) {
    try {
      // Получаем office_id текущего пользователя из базы данных
      const currentUser = await User.findByPk(user.id);
      const officeId = currentUser.office_id;

      // Получаем всех department-head пользователей с соответствующими параметрами
      const departmentHeads = await User.findAll({
        where: {
          role: 'department-head',
          office_id: officeId,
        },
        attributes: ['id', 'full_name', 'phone', 'email_notifications']
      });

      // Формируем уведомление
      let title = `Новая заявка перенаправлена к вам`;
      let content = `
        Подзаявка #${requestId} была перенаправлена к вам от другого руководителя.
        Пожалуйста, рассмотрите заявку и назначьте исполнителя.
      `.trim();
      let notificationPromises = [];
      departmentHeads.map(departmentHead => {
        notificationPromises.push(notificationService.saveNotification(departmentHead.id, title, content))
        // if (departmentHead.email_notifications) {
        //   notificationPromises.push(notificationService.sendEmailNotification(departmentHead.email, title, content));
        // }
      });

      // Ждем завершения всех уведомлений
      await Promise.allSettled(notificationPromises);

      logger.info('Отправлены уведомления department-head о перенаправлении подзаявки', {
        count: departmentHeads.length,
        requestId
      });
    } catch (error) {
      logger.error('Ошибка при обработке patch_code: 1 (handleRedirectRequest)', { error: error?.message });
    }
  }
}

export default RequestService
