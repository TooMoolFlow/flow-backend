import { col, fn, literal, Op } from 'sequelize';
import { Executor, Request, RequestExecutor, RequestGroup, RequestRating, User, ClientRating } from '../models/init.model.js';
import { NotFoundError } from '../errors/errors.js';

class StatisticsService {
    static async getClientStats(userId) {
        const requests = await RequestGroup.findAll({
            where: { client_id: userId },
            attributes: [
                [fn('COUNT', col('id')), 'totalRequests'],
                [fn('COUNT', literal(`CASE WHEN status IN ('in_progress', 'execution', 'assigned','awaiting_assignment') THEN 1 END`)), 'activeRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'completed' THEN 1 END`)), 'doneRequests']
            ],
            raw: true
        });

        // Overdue requests: completed, date_submitted, sla, actual_completion_date all present, and SLA interval < actual_completion_date
        const overdueCount = await RequestGroup.findAll({
            where: { client_id: userId },
            attributes: [
                [fn('COUNT', literal(`DISTINCT "RequestGroup"."id"`)), 'overdueCount']
            ],
            include: [{
                model: Request,
                as: 'requests',
                attributes: [],
                where: literal(`"RequestGroup".status = 'completed' AND "RequestGroup".date_submitted IS NOT NULL AND "requests"."sla" IS NOT NULL AND "requests"."actual_completion_date" IS NOT NULL AND (
                    CASE 
                        WHEN "requests"."sla" LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'h', '') || ' hours')::interval
                        WHEN "requests"."sla" LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'd', '') || ' days')::interval
                        WHEN "requests"."sla" LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'w', '') || ' weeks')::interval
                        WHEN "requests"."sla" LIKE '%m' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'm', '') || ' months')::interval
                        WHEN "requests"."sla" LIKE '%y' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'y', '') || ' years')::interval
                    END
                ) < "requests"."actual_completion_date"`)
            }],
            raw: true
        });

        // Получаем среднюю оценку клиента от исполнителей
        const clientRating = await ClientRating.findOne({
            where: { client_id: userId },
            attributes: [
                [fn('AVG', col('rating')), 'averageRating'],
                [fn('COUNT', col('id')), 'totalRatings']
            ],
            raw: true
        });

        return {
            totalRequests: parseInt(requests[0].totalRequests, 10),
            activeRequests: parseInt(requests[0].activeRequests, 10),
            doneRequests: parseInt(requests[0].doneRequests, 10),
            overdueRequests: parseInt(overdueCount[0]?.overdueCount || 0, 10),
            averageRating: parseFloat(clientRating?.averageRating || 0).toFixed(2),
            totalRatings: parseInt(clientRating?.totalRatings || 0, 10)
        };
    }

    static async getAdminWorkerStats(userId) {
        // Проверяем, что пользователь существует
        const user = await User.findByPk(userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const [results] = await RequestGroup.findAll({
            attributes: [
                [fn('COUNT', col('id')), 'totalRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'in_progress' THEN 1 END`)), 'newRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'execution' THEN 1 END`)), 'inWork'],
                [fn('COUNT', literal(`CASE WHEN status = 'completed' THEN 1 END`)), 'completed']
            ],
            raw: true
        });

        const overdueCount = await RequestGroup.findAll({
            attributes: [
                [fn('COUNT', literal(`DISTINCT "RequestGroup"."id"`)), 'overdueCount']
            ],
            include: [{
                model: Request,
                as: 'requests',
                attributes: [],
                where: literal(`"RequestGroup".status = 'completed' AND "RequestGroup".date_submitted IS NOT NULL AND "requests"."sla" IS NOT NULL AND "requests"."actual_completion_date" IS NOT NULL AND (
                    CASE 
                        WHEN "requests"."sla" LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'h', '') || ' hours')::interval
                        WHEN "requests"."sla" LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'd', '') || ' days')::interval
                        WHEN "requests"."sla" LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'w', '') || ' weeks')::interval
                        WHEN "requests"."sla" LIKE '%m' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'm', '') || ' months')::interval
                        WHEN "requests"."sla" LIKE '%y' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'y', '') || ' years')::interval
                    END
                ) < "requests"."actual_completion_date"`)
            }],
            raw: true
        });

        const typeCounts = await RequestGroup.findAll({
            attributes: ['request_type', [fn('COUNT', col('id')), 'count']],
            group: ['request_type'],
            raw: true
        });

        const requestTypeSummary = {};
        typeCounts.forEach((row) => {
            requestTypeSummary[row.request_type] = parseInt(row.count);
        });

        return {
            totalRequests: parseInt(results.totalRequests, 10),
            statusCounts: {
                new: parseInt(results.newRequests, 10),
                inWork: parseInt(results.inWork, 10),
                completed: parseInt(results.completed,   10),
                overdue: parseInt(overdueCount[0]?.overdueCount || 0, 10)
            },
            requestTypeSummary
        };
    }

    static async getDepartmentHeadStats(userId) {
        // Статистика по всем заявкам офиса (все категории услуг)
        const user = await User.findByPk(userId);
        if (!user || !user.office_id) {
            throw new NotFoundError('User not found or not assigned to office');
        }

        const [results] = await RequestGroup.findAll({
            where: {
                office_id: user.office_id,
                request_type: { [Op.ne]: 'recurring' },
            },
            attributes: [
                [fn('COUNT', literal(`DISTINCT "RequestGroup"."id"`)), 'totalRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "RequestGroup"."status" = 'in_progress' THEN "RequestGroup"."id" END`)), 'newRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "RequestGroup"."status" = 'awaiting_assignment' THEN "RequestGroup"."id" END`)), 'awaitingAssignment'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "RequestGroup"."status" = 'execution' THEN "RequestGroup"."id" END`)), 'inWork'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "RequestGroup"."status" = 'completed' THEN "RequestGroup"."id" END`)), 'completed']
            ],
            raw: true
        });

        const overdueCount = await RequestGroup.findAll({
            where: {
                office_id: user.office_id,
                request_type: { [Op.ne]: 'recurring' },
            },
            attributes: [
                [fn('COUNT', literal(`DISTINCT "RequestGroup"."id"`)), 'overdueCount'],
            ],
            include: [{
                model: Request,
                as: 'requests',
                attributes: [],
                where: literal(`"RequestGroup".status = 'completed' AND "RequestGroup".date_submitted IS NOT NULL AND "requests"."sla" IS NOT NULL AND "requests"."actual_completion_date" IS NOT NULL AND (
                    CASE
                        WHEN "requests"."sla" LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'h', '') || ' hours')::interval
                        WHEN "requests"."sla" LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'd', '') || ' days')::interval
                        WHEN "requests"."sla" LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'w', '') || ' weeks')::interval
                        WHEN "requests"."sla" LIKE '%m' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'm', '') || ' months')::interval
                        WHEN "requests"."sla" LIKE '%y' THEN "RequestGroup".date_submitted + (REPLACE("requests"."sla", 'y', '') || ' years')::interval
                    END
                ) < "requests"."actual_completion_date"`),
            }],
            raw: true,
        });

        const typeCounts = await RequestGroup.findAll({
            where: {
                office_id: user.office_id,
                request_type: { [Op.ne]: 'recurring' },
            },
            attributes: ['request_type', [fn('COUNT', col('id')), 'count']],
            group: ['request_type'],
            raw: true,
        });

        const requestTypeSummary = {};
        typeCounts.forEach((row) => {
            requestTypeSummary[row.request_type] = parseInt(row.count);
        });

        return {
            totalRequests: parseInt(results.totalRequests, 10),
            statusCounts: {
                awaitingAssignment: parseInt(results.awaitingAssignment, 10),
                new: parseInt(results.newRequests, 10),
                inWork: parseInt(results.inWork, 10),
                completed: parseInt(results.completed,   10),
                overdue: parseInt(overdueCount[0]?.overdueCount || 0, 10)
            },
            requestTypeSummary
        };
    };

    static async getExecutorStats(userId) {
        const executor = await Executor.findOne({
            where: { user_id: userId },
        });
        
        if (!executor) {
            throw new NotFoundError('Executor not found');
        }

        // Получаем все заявки исполнителя
        const results = await Request.findAll({
            attributes: [
                [fn('COUNT', col('Request.id')), 'total'],
                [fn('COUNT', literal(`CASE WHEN "Request"."status" = 'execution' THEN 1 END`)), 'inWork'],
                [fn('COUNT', literal(`CASE WHEN "Request"."status" = 'completed' THEN 1 END`)), 'completed'],
                [fn('COUNT', literal(`CASE WHEN "Request"."status" = 'completed'
                                AND "Request"."sla" IS NOT NULL
                                AND "requestGroup"."date_submitted" IS NOT NULL
                                AND "Request"."actual_completion_date" IS NOT NULL
                                AND "Request"."actual_completion_date" <= (
                                    "requestGroup"."date_submitted" + (
                                        CASE 
                                            WHEN "Request"."sla" LIKE '%h' THEN (REPLACE("Request"."sla", 'h', '') || ' hours')::interval
                                            WHEN "Request"."sla" LIKE '%d' THEN (REPLACE("Request"."sla", 'd', '') || ' days')::interval
                                            WHEN "Request"."sla" LIKE '%w' THEN (REPLACE("Request"."sla", 'w', '') || ' weeks')::interval
                                            WHEN "Request"."sla" LIKE '%m' THEN (REPLACE("Request"."sla", 'm', '') || ' months')::interval
                                            WHEN "Request"."sla" LIKE '%y' THEN (REPLACE("Request"."sla", 'y', '') || ' years')::interval
                                        END
                                    )
                                )
                                THEN 1 END`)), 'onTime'],
                [fn('COUNT', literal(`CASE WHEN "Request"."status" = 'completed'
                                AND "Request"."sla" IS NOT NULL
                                AND "requestGroup"."date_submitted" IS NOT NULL
                                AND "Request"."actual_completion_date" IS NOT NULL
                                AND "Request"."actual_completion_date" > (
                                    "requestGroup"."date_submitted" + (
                                        CASE 
                                            WHEN "Request"."sla" LIKE '%h' THEN (REPLACE("Request"."sla", 'h', '') || ' hours')::interval
                                            WHEN "Request"."sla" LIKE '%d' THEN (REPLACE("Request"."sla", 'd', '') || ' days')::interval
                                            WHEN "Request"."sla" LIKE '%w' THEN (REPLACE("Request"."sla", 'w', '') || ' weeks')::interval
                                            WHEN "Request"."sla" LIKE '%m' THEN (REPLACE("Request"."sla", 'm', '') || ' months')::interval
                                            WHEN "Request"."sla" LIKE '%y' THEN (REPLACE("Request"."sla", 'y', '') || ' years')::interval
                                        END
                                    )
                                )
                                THEN 1 END`)), 'overdue'],
                [fn('AVG', literal(`CASE 
                    WHEN "Request"."status" = 'completed' 
                    AND "Request"."actual_completion_date" IS NOT NULL 
                    AND "requestGroup"."date_submitted" IS NOT NULL
                    THEN EXTRACT(EPOCH FROM "Request"."actual_completion_date" - "requestGroup"."date_submitted") / 3600
                    ELSE NULL
                END`)), 'avgHours']
            ],
            include: [
                {
                    model: RequestGroup,
                    as: 'requestGroup',
                    attributes: []
                },
                {
                    model: RequestExecutor,
                    as: 'requestExecutors',
                    attributes: [],
                    where: { executor_id: executor.id }
                }
            ],
            subQuery: false,
            raw: true
        });

        // Получаем средний рейтинг исполнителя
        const rating = await RequestRating.findAll({
            attributes: [[fn('AVG', col('rating')), 'avg_rating']],
            include: [{
                model: Request,
                required: true,
                include: [{
                    model: RequestExecutor,
                    as: 'requestExecutors',
                    attributes: [],
                    where: { executor_id: executor.id }
                }],
                attributes: []
            }],
            subQuery: false,
            raw: true
        });

        const stats = results[0];
        const totalRequests = parseInt(stats.total, 10) || 0;
        const inWork = parseInt(stats.inWork, 10) || 0;
        const completed = parseInt(stats.completed, 10) || 0;
        const onTime = parseInt(stats.onTime, 10) || 0;
        const overdue = parseInt(stats.overdue, 10) || 0;
        const avgHours = parseFloat(stats.avgHours, 10) || 0;
        const avgRating = parseFloat(rating[0]?.avg_rating, 10) || 0;
        return {
            totalRequests,
            overdue,
            inWork,
            completed,
            onTime,
            averageExecutionHours: avgHours.toFixed(2),
            averageRating: avgRating.toFixed(2)
        };
    };

    static async getManagerStats() {
        const requests = await RequestGroup.findAll({
            attributes: [
                [fn('DATE', col('created_date')), 'date'],
                'office_id',
                [fn('COUNT', col('id')), 'totalRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'in_progress' THEN 1 END`)), 'newRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'execution' THEN 1 END`)), 'inWorkRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'completed' THEN 1 END`)), 'completedRequests'],
                [fn('COUNT', literal(`CASE WHEN request_type = 'urgent' AND status = 'completed' AND date_submitted IS NOT NULL AND EXISTS (
                    SELECT 1 FROM requests r 
                    WHERE r.request_group_id = "RequestGroup".id 
                    AND r.sla IS NOT NULL 
                    AND r.actual_completion_date IS NOT NULL
                    AND (
                        CASE 
                            WHEN r.sla LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'h', '') || ' hours')::interval
                            WHEN r.sla LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'd', '') || ' days')::interval
                            WHEN r.sla LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'w', '') || ' weeks')::interval
                            WHEN r.sla LIKE '%m' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'm', '') || ' months')::interval
                            WHEN r.sla LIKE '%y' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'y', '') || ' years')::interval
                        END
                    ) < r.actual_completion_date
                ) THEN 1 END`)), 'overdueUrgentRequests'],
                [fn('COUNT', literal(`CASE WHEN status = 'completed' AND date_submitted IS NOT NULL AND EXISTS (
                    SELECT 1 FROM requests r 
                    WHERE r.request_group_id = "RequestGroup".id 
                    AND r.sla IS NOT NULL 
                    AND r.actual_completion_date IS NOT NULL
                    AND (
                        CASE 
                            WHEN r.sla LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'h', '') || ' hours')::interval
                            WHEN r.sla LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'd', '') || ' days')::interval
                            WHEN r.sla LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'w', '') || ' weeks')::interval
                            WHEN r.sla LIKE '%m' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'm', '') || ' months')::interval
                            WHEN r.sla LIKE '%y' THEN "RequestGroup".date_submitted + (REPLACE(r.sla, 'y', '') || ' years')::interval
                        END
                    ) < r.actual_completion_date
                ) THEN 1 END`)), 'overdueRequests'],
                [fn('COUNT', literal(`CASE WHEN request_type = 'normal' THEN 1 END`)), 'normalRequests'],
                [fn('COUNT', literal(`CASE WHEN request_type = 'urgent' THEN 1 END`)), 'urgentRequests'],
                [fn('COUNT', literal(`CASE WHEN request_type = 'planned' THEN 1 END`)), 'plannedRequests']
            ],
            group: [fn('DATE', col('created_date')), 'office_id'],
            order: [[fn('DATE', col('created_date')), 'ASC']],
            raw: true
        });

        const grouped = {};

        for (const r of requests) {
            const officeId = r.office_id;
            const date = r.date;

            if (!grouped[officeId]) grouped[officeId] = {};
            grouped[officeId][date] = {
                totalRequests: parseInt(r.totalRequests, 10),
                newRequests: parseInt(r.newRequests, 10),
                inWorkRequests: parseInt(r.inWorkRequests, 10),
                completedRequests: parseInt(r.completedRequests, 10),
                overdueRequests: parseInt(r.overdueRequests, 10),
                normalRequests: parseInt(r.normalRequests, 10),
                urgentRequests: parseInt(r.urgentRequests, 10),
                plannedRequests: parseInt(r.plannedRequests, 10)
            };
        }

        return Object.entries(grouped).map(([officeId, data]) => ({
            officeId: parseInt(officeId, 10),
            data
        }));
    }

    // Новые методы для менеджера

    static async getSLAStats() {
        // Статистика SLA по времени
        const slaByDate = await Request.findAll({
            attributes: [
                [fn('DATE', col('actual_completion_date')), 'date'],
                [fn('AVG', literal(`EXTRACT(EPOCH FROM "Request"."actual_completion_date" - "requestGroup"."date_submitted") / 3600`)), 'avgHours'],
                [fn('COUNT', col('Request.id')), 'totalCompleted']
            ],
            include: [{
                model: RequestGroup,
                as: 'requestGroup',
                attributes: [],
                where: literal(`"requestGroup"."date_submitted" IS NOT NULL`)
            }],
            where: literal(`"Request"."actual_completion_date" IS NOT NULL AND "Request"."sla" IS NOT NULL`),
            group: [fn('DATE', col('actual_completion_date'))],
            order: [[fn('DATE', col('actual_completion_date')), 'ASC']],
            raw: true
        });

        // SLA по категориям
        const slaByCategory = await Request.findAll({
            attributes: [
                'category_id',
                [fn('AVG', literal(`EXTRACT(EPOCH FROM "Request"."actual_completion_date" - "requestGroup"."date_submitted") / 3600`)), 'avgHours'],
                [fn('COUNT', col('Request.id')), 'totalCompleted']
            ],
            include: [{
                model: RequestGroup,
                as: 'requestGroup',
                attributes: [],
                where: literal(`"requestGroup"."date_submitted" IS NOT NULL`)
            }],
            where: literal(`"Request"."actual_completion_date" IS NOT NULL AND "Request"."sla" IS NOT NULL`),
            group: ['category_id'],
            raw: true
        });

        // SLA по офисам
        const slaByOffice = await Request.findAll({
            attributes: [
                'requestGroup.office_id',
                [fn('AVG', literal(`EXTRACT(EPOCH FROM "Request"."actual_completion_date" - "requestGroup"."date_submitted") / 3600`)), 'avgHours'],
                [fn('COUNT', col('Request.id')), 'totalCompleted']
            ],
            include: [{
                model: RequestGroup,
                as: 'requestGroup',
                attributes: [],
                where: literal(`"requestGroup"."date_submitted" IS NOT NULL`)
            }],
            where: literal(`"Request"."actual_completion_date" IS NOT NULL AND "Request"."sla" IS NOT NULL`),
            group: ['requestGroup.office_id'],
            raw: true
        });

        return {
            byDate: slaByDate.map(item => ({
                date: item.date,
                avgHours: parseFloat(item.avgHours || 0).toFixed(2),
                totalCompleted: parseInt(item.totalCompleted, 10)
            })),
            byCategory: slaByCategory.map(item => ({
                categoryId: item.category_id,
                avgHours: parseFloat(item.avgHours || 0).toFixed(2),
                totalCompleted: parseInt(item.totalCompleted, 10)
            })),
            byOffice: slaByOffice.map(item => ({
                officeId: item['requestGroup.office_id'],
                avgHours: parseFloat(item.avgHours || 0).toFixed(2),
                totalCompleted: parseInt(item.totalCompleted, 10)
            }))
        };
    }

    static async getRatingStats() {
        // Средние оценки по офисам
        const ratingsByOffice = await RequestRating.findAll({
            attributes: [
                'Request.requestGroup.office_id',
                [fn('AVG', col('RequestRating.rating')), 'avgRating'],
                [fn('COUNT', col('RequestRating.id')), 'totalRatings'],
                [fn('COUNT', literal(`CASE WHEN "RequestRating"."rating" IN (1, 2) THEN 1 END`)), 'lowRatings']
            ],
            include: [{
                model: Request,
                required: true,
                include: [{
                    model: RequestGroup,
                    as: 'requestGroup',
                    attributes: []
                }],
                attributes: []
            }],
            group: ['Request.requestGroup.office_id'],
            raw: true
        });
        
        // Средние оценки по категориям
        const ratingsByCategory = await RequestRating.findAll({
            attributes: [
                'Request.category_id',
                [fn('AVG', col('RequestRating.rating')), 'avgRating'],
                [fn('COUNT', col('RequestRating.id')), 'totalRatings'],
                [fn('COUNT', literal(`CASE WHEN "RequestRating"."rating" IN (1, 2) THEN 1 END`)), 'lowRatings']
            ],
            include: [{
                model: Request,
                required: true,
                attributes: []
            }],
            group: ['Request.category_id'],
            raw: true
        });
        
        // Средние оценки по исполнителям
        const ratingsByExecutor = await RequestRating.findAll({
            attributes: [
                'Request.requestExecutors.executor_id',
                [fn('AVG', col('RequestRating.rating')), 'avgRating'],
                [fn('COUNT', col('RequestRating.id')), 'totalRatings'],
                [fn('COUNT', literal(`CASE WHEN "RequestRating"."rating" IN (1, 2) THEN 1 END`)), 'lowRatings']
            ],
            include: [{
                model: Request,
                required: true,
                include: [{
                    model: RequestExecutor,
                    as: 'requestExecutors',
                    attributes: []
                }],
                attributes: []
            }],
            group: ['Request.requestExecutors.executor_id'],
            raw: true
        });

        // Средние оценки по клиентам
        const ratingsByClient = await RequestRating.findAll({
            attributes: [
                'Request.requestGroup.client_id',
                [fn('AVG', col('RequestRating.rating')), 'avgRating'],
                [fn('COUNT', col('RequestRating.id')), 'totalRatings'],
                [fn('COUNT', literal(`CASE WHEN "RequestRating"."rating" IN (1, 2) THEN 1 END`)), 'lowRatings']
            ],
            include: [{
                model: Request,
                required: true,
                include: [{
                    model: RequestGroup,
                    as: 'requestGroup',
                    attributes: []
                }],
                attributes: []
            }],
            group: ['Request.requestGroup.client_id'],
            raw: true
        });

        // Динамика оценок по времени
        const ratingsByDate = await RequestRating.findAll({
            attributes: [
                [fn('DATE', col('rated_at')), 'date'],
                [fn('AVG', col('rating')), 'avgRating'],
                [fn('COUNT', col('id')), 'totalRatings'],
                [fn('COUNT', literal(`CASE WHEN rating IN (1, 2) THEN 1 END`)), 'lowRatings']
            ],
            group: [fn('DATE', col('rated_at'))],
            order: [[fn('DATE', col('rated_at')), 'ASC']],
            raw: true
        });

        return {
            byOffice: ratingsByOffice
                .filter(item => item['office_id'] != null && item['office_id'] !== undefined)
                .map(item => ({
                    officeId: item['office_id'],
                    avgRating: parseFloat(item.avgRating || 0).toFixed(2),
                    totalRatings: parseInt(item.totalRatings, 10),
                    lowRatings: parseInt(item.lowRatings, 10)
                })),
            byCategory: ratingsByCategory
                .filter(item => item['category_id'] != null && item['category_id'] !== undefined)
                .map(item => ({
                    categoryId: item['category_id'],
                    avgRating: parseFloat(item.avgRating || 0).toFixed(2),
                    totalRatings: parseInt(item.totalRatings, 10),
                    lowRatings: parseInt(item.lowRatings, 10)
                })),
            byExecutor: ratingsByExecutor
                .filter(item => item['executor_id'] != null && item['executor_id'] !== undefined)
                .map(item => ({
                    executorId: item['executor_id'],
                    avgRating: parseFloat(item.avgRating || 0).toFixed(2),
                    totalRatings: parseInt(item.totalRatings, 10),
                    lowRatings: parseInt(item.lowRatings, 10)
                })),
            byClient: ratingsByClient
                .filter(item => item['client_id'] != null && item['client_id'] !== undefined)
                .map(item => ({
                    clientId: item['client_id'],
                    avgRating: parseFloat(item.avgRating || 0).toFixed(2),
                    totalRatings: parseInt(item.totalRatings, 10),
                    lowRatings: parseInt(item.lowRatings, 10)
                })),
            byDate: ratingsByDate.map(item => ({
                date: item.date,
                avgRating: parseFloat(item.avgRating || 0).toFixed(2),
                totalRatings: parseInt(item.totalRatings, 10),
                lowRatings: parseInt(item.lowRatings, 10)
            }))
        };
    }

    static async getDetailedStats() {
        // Статистика по категориям заявок
        const statsByCategory = await Request.findAll({
            attributes: [
                'category_id',
                [fn('COUNT', literal(`DISTINCT "Request"."id"`)), 'totalRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "Request"."status" = 'completed' THEN "Request"."id" END`)), 'completedRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "Request"."status" = 'in_progress' THEN "Request"."id" END`)), 'newRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "Request"."status" = 'execution' THEN "Request"."id" END`)), 'inWorkRequests']
            ],
            group: ['category_id'],
            raw: true
        });
        
        // Статистика по направлениям (service_category_id из пользователей)
        const statsByDirection = await Request.findAll({
            attributes: [
                'category_id',
                [fn('COUNT', literal(`DISTINCT "Request"."id"`)), 'totalRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "Request"."status" = 'completed' THEN "Request"."id" END`)), 'completedRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "Request"."status" = 'in_progress' THEN "Request"."id" END`)), 'newRequests'],
                [fn('COUNT', literal(`DISTINCT CASE WHEN "Request"."status" = 'execution' THEN "Request"."id" END`)), 'inWorkRequests']
            ],
            group: ['category_id'],
            raw: true
        });
        
        // Статистика по исполнителям
        const statsByExecutor = await RequestExecutor.findAll({
            attributes: [
                'executor_id',
                [fn('COUNT', col('RequestExecutor.id')), 'totalAssigned'],
                [fn('COUNT', literal(`CASE WHEN "Request"."status" = 'completed' THEN 1 END`)), 'completedRequests'],
                [fn('COUNT', literal(`CASE WHEN "Request"."status" = 'execution' THEN 1 END`)), 'inWorkRequests']
            ],
            include: [{
                model: Request,
                as: 'Request',
                attributes: []
            }],
            group: ['executor_id'],
            raw: true
        });


        
        return {
            byCategory: statsByCategory
                .filter(item => item['category_id'] != null && item['category_id'] !== undefined)
                .map(item => ({
                    categoryId: item['category_id'],
                    totalRequests: parseInt(item.totalRequests, 10),
                    completedRequests: parseInt(item.completedRequests, 10),
                    newRequests: parseInt(item.newRequests, 10),
                    inWorkRequests: parseInt(item.inWorkRequests, 10)
                })),
            byDirection: statsByDirection
                .filter(item => item['category_id'] != null && item['category_id'] !== undefined)
                .map(item => ({
                    directionId: item['category_id'],
                    totalRequests: parseInt(item.totalRequests, 10),
                    completedRequests: parseInt(item.completedRequests, 10),
                    newRequests: parseInt(item.newRequests, 10),
                    inWorkRequests: parseInt(item.inWorkRequests, 10)
                })),
            byExecutor: statsByExecutor.map(item => ({
                executorId: item.executor_id,
                totalAssigned: parseInt(item.totalAssigned, 10),
                completedRequests: parseInt(item.completedRequests, 10),
                inWorkRequests: parseInt(item.inWorkRequests, 10)
            }))
        };
    }
}

export default StatisticsService;