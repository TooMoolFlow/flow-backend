import {Executor, Request, RequestExecutor, RequestGroup, User} from '../models/init.model.js';
import {BadRequestError, ForbiddenError, NotFoundError} from "../errors/errors.js";
import { assertDepartmentHeadCanAssignExecutor } from '../utils/departmentHeadAssign.util.js';
import RequestLogger from "../utils/requestLogger.js";
import NotificationService from "./notification.service.js";
import { sequelize } from '../config/database.config.js';
import RequestGroupService from './requestGroup.service.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import logger from '../utils/winston/logger.js';

class RequestExecutorService {
    static async assignExecutorsToRequestWhenCreateRequest(requestId, signingExecutors, transaction = null) {
        const request = await Request.findByPk(requestId, {transaction});
        if (!request) {
            throw new NotFoundError('Request not found');
        }
        const assignments = [];

        for (const executor of signingExecutors) {
            const assignment = await RequestExecutor.create({
                request_id: requestId,
                executor_id: executor.id,
                role: executor.role,
                status: 'assigned'
            }, { transaction });
            assignments.push(assignment);
        }

        return assignments;
    }

    static async assignExecutorsToRequest(requestId, signingExecutors, userId, req) {
        const tx = await sequelize.transaction();
        let request;
        try {
            const headUser = await User.findByPk(userId, { transaction: tx });
            request = await Request.findByPk(requestId, {
                include: [{ model: RequestGroup, as: 'requestGroup' }],
                transaction: tx,
            });
            if (!request) {
                throw new NotFoundError('Request not found');
            }
            if (request.status !== 'awaiting_assignment') {
                throw new BadRequestError("Not available request status");
            }

            await RequestExecutor.destroy({
                where: { request_id: request.id },
                transaction: tx,
            });

            for (const singingExecutor of signingExecutors) {
                const executor = await Executor.findOne({
                    where: { id: singingExecutor.id },
                    include: { model: User, as: 'user' },
                    transaction: tx
                });
                if (!executor) {
                    throw new NotFoundError('Executor not found');
                } else if (executor.user.role !== 'executor') {
                    throw new BadRequestError('Error executor');
                } else if (headUser?.role === 'department-head') {
                    await assertDepartmentHeadCanAssignExecutor(
                        headUser,
                        executor,
                        request,
                        tx
                    );
                } else if (Number(executor.user.office_id) !== Number(headUser?.office_id)) {
                    throw new ForbiddenError('Forbiddenn');
                }

                await RequestExecutor.create({
                    request_id: request.id,
                    executor_id: executor.id,
                    role: singingExecutor.role
                }, { transaction: tx });
                singingExecutor.full_name = executor.user.full_name;
                singingExecutor.user_id = executor.user.id;
            }
            request.status = 'assigned';
            await request.save({transaction: tx});
            await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);

            await tx.commit()
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }

        Promise.all(signingExecutors.map(executor =>
            RequestLogger.logExecutorAssigned(
                requestId,
                userId,
                executor.id,
                executor.full_name,
                executor.role || 'executor',
                req ? RequestLogger.getIpAddress(req) : null,
                req ? RequestLogger.getUserAgent(req) : null
            )
        )).catch(err => logger.error('Ошибка при логировании назначения исполнителя', { error: err?.message }));

        Promise.all(signingExecutors.map((executor) => {
                NotificationService.sendNotification({
                    userId: executor.user_id,
                    request: request,
                    type: 'assigned'
                })
            })
        ).catch(err => {
            logger.error('Ошибка при отправке уведомления', { error: err?.message });
        });

        Promise.resolve(
            NotificationService.sendNotification({
            userId: request.requestGroup.client_id,
            request: request,
            type: 'user_request_assigned'
            })
        ).catch(err => {
            logger.error('Ошибка при отправке уведомления', { error: err?.message });
        });

        return { success: true, requestId: request.id, status: request.status };
    }

    static async changeExecutorsForRequest(requestId, signingExecutors, userId, req) {
        const tx = await sequelize.transaction();
        let request;
        try {
            const user = await User.findByPk(userId, {
                transaction: tx
            });
            request = await Request.findByPk(requestId, {
                include: [
                    { model: RequestGroup, as: 'requestGroup' },
                    {
                        model: RequestExecutor,
                        as: 'requestExecutors',
                        include: [{ model: Executor, as: 'executor', include: [{ model: User, as: 'user' }] }]
                    }
                ],
                transaction: tx,
            });
            if (!request) {
                throw new NotFoundError('Request not found');
            }

            // Удаляем всех текущих исполнителей
            await RequestExecutor.destroy({
                where: { request_id: requestId },
                transaction: tx
            });

            // Добавляем новых исполнителей
            for (const singingExecutor of signingExecutors) {
                const executor = await Executor.findOne({
                    where: { id: singingExecutor.id },
                    include: { model: User, as: 'user' },
                    transaction: tx
                });
                if (!executor) {
                    throw new NotFoundError('Executor not found');
                } else if (executor.user.role !== 'executor') {
                    throw new BadRequestError('Error executor');
                } else if (user.role === 'department-head') {
                    await assertDepartmentHeadCanAssignExecutor(
                        user,
                        executor,
                        request,
                        tx
                    );
                } else if (executor.department_id !== userId) {
                    throw new ForbiddenError('Forbidden');
                }

                await RequestExecutor.create({
                    request_id: request.id,
                    executor_id: executor.id,
                    role: singingExecutor.role
                }, { transaction: tx });
                singingExecutor.full_name = executor.user.full_name;
                singingExecutor.user_id = executor.user.id;
            }

            await tx.commit()
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }

        // Логируем изменение исполнителей
        Promise.all(signingExecutors.map((executor) => {
                RequestLogger.logExecutorAssigned(
                    requestId,
                    userId,
                    executor.id,
                    executor.full_name,
                    executor.role,
                    req ? RequestLogger.getIpAddress(req) : null,
                    req ? RequestLogger.getUserAgent(req) : null
                )
            })
        ).catch(err => {
            logger.error('Ошибка при логировании изменения исполнителей', { error: err?.message });
        });

        // Отправляем уведомления новым исполнителям
        Promise.all(signingExecutors.map((executor) => {
                NotificationService.sendNotification({
                    userId: executor.user_id,
                    request: request,
                    type: 'assigned'
                })
            })
        ).catch(err => {
            logger.error('Ошибка при отправке уведомления', { error: err?.message });
        });

        // Отправляем уведомление клиенту
        Promise.resolve(
            NotificationService.sendNotification({
            userId: request.requestGroup.client_id,
            request: request,
            type: 'user_request_assigned'
            })
        ).catch(err => {
            logger.error('Ошибка при отправке уведомления', { error: err?.message });
        });

        return request;
    }

    static async updateExecutorStatus(requestId, userId, patch_code, req) {
        let updatedRequestGroup;
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
            const isLeader = request.requestExecutors.some(
                (reqExecutor) => reqExecutor.executor.user_id === userId && reqExecutor.role === 'leader'
            );

            if (!isLeader) {
                throw new ForbiddenError('Forbidden');
            }

            if (patch_code === 1) {
                request.status = 'execution';
            } else if (patch_code === 2) {
                request.status = 'completed';
                request.actual_completion_date = new Date();
                request.comment = req.body.comment;
            } else {
                throw new BadRequestError('Patch Code is incorrect');
            }

            await request.save({transaction: tx});
            updatedRequestGroup = await RequestGroupService.updateRequestGroupStatus(request.requestGroup.id, tx);
            await tx.commit();
        } catch (error) {
            await rollbackAndRethrow(tx, error);
        }

        if (patch_code === 2) {
            // Логируем завершение заявки
            Promise.resolve(
                RequestLogger.logRequestCompleted(
                    request.id,
                    userId,
                    req.body.comment,
                    req ? RequestLogger.getIpAddress(req) : null,
                    req ? RequestLogger.getUserAgent(req) : null
                )
            ).catch(err => {
                logger.error('Ошибка при логировании завершения заявки', { error: err?.message });
            });

            Promise.resolve(
                NotificationService.sendNotification({
                    userId: request.requestGroup.client_id,
                    request: request,
                    type: 'end_request',
                    completedByUserId: userId,
                })
            ).catch(err => {
                logger.error('Ошибка при отправке уведомления', { error: err?.message });
            });
        } else if (patch_code === 1) {
            // Логируем начало выполнения заявки
            Promise.resolve(
                RequestLogger.logRequestStarted(
                    request.id,
                    userId,
                    req ? RequestLogger.getIpAddress(req) : null,
                    req ? RequestLogger.getUserAgent(req) : null
                )
            ).catch(err => {
                logger.error('Ошибка при логировании начала заявки', { error: err?.message });
            });

            const message = `Заявка: № ${request.id}`.trim();

            Promise.resolve(
                NotificationService.sendNotification({
                    userId:  request.requestGroup.client_id,
                    request: request.requestGroup,
                    content: message,
                    type: 'start_request'
                })
            ).catch(err => {
                logger.error('Ошибка при отправке уведомления', { error: err?.message });
            });
        }

        return updatedRequestGroup;
    }

}

export default RequestExecutorService;
