import { Op } from 'sequelize';
import { parseSlaToMinutes } from '../utils/slaParser.js';
import { fn, literal } from 'sequelize';

class AnalyticService {

    /**
     * Строит объект фильтров для экспорта аналитики из query (office_id, from, to).
     */
    static buildExportFilters(query = {}) {
        const filters = {};
        if (query.office_id) {
            const parsedOfficeId = parseInt(query.office_id, 10);
            if (!isNaN(parsedOfficeId)) {
                filters.office_id = parsedOfficeId;
            }
        }
        if (query.from || query.to) {
            const dateFilter = {};
            if (query.from) {
                dateFilter[Op.gte] = new Date(query.from);
            }
            if (query.to) {
                const toDate = new Date(query.to);
                toDate.setHours(23, 59, 59, 999);
                dateFilter[Op.lte] = toDate;
            }
            const hasData = Object.keys(dateFilter).length > 0 || Object.getOwnPropertySymbols(dateFilter).length > 0;
            if (hasData) {
                filters.created_date = dateFilter;
            }
        }
        return filters;
    }

    static async getExcelAnalytics(filters = {}) {
        const { default: ExcelJS } = await import('exceljs');
        const { RequestGroup, Request, RequestRating, RequestExecutor, Executor, User } = await import('../models/init.model.js');

        // Получаем данные с рейтингами через RequestGroup и вложенные Requests
        const dataGroups = await RequestGroup.findAll({
            attributes: ['id', 'status', 'office_id', 'date_submitted', 'created_date'],
            include: [
                {
                    model: Request,
                    as: 'requests',
                    where: filters, // Применяем фильтр к заявкам, а не к группам
                    attributes: [
                        'id', 'title', 'description', 'status', 'category_id', 'complexity',
                        'sla', 'plan_id', 'actual_completion_date', 'rejection_reason', 
                        'comment', 'created_date', 'is_long_term'
                    ],
                    include: [
                        {
                            model: RequestRating,
                            as: 'ratings',
                            attributes: ['rating']
                        },
                        {
                            model: RequestExecutor,
                            as: 'requestExecutors',
                            attributes: ['executor_id'],
                            include: [
                                {
                                    model: Executor,
                                    as: 'executor',
                                    attributes: ['id', 'user_id'],
                                    include: [
                                        {
                                            model: User,
                                            as: 'user',
                                            attributes: ['full_name']
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        // Отладочная информация о структуре данных
        console.log(`AnalyticService: Data structure debug:`);
        if (dataGroups.length > 0 && dataGroups[0].requests && dataGroups[0].requests.length > 0) {
            const firstRequest = dataGroups[0].requests[0];
            console.log(`AnalyticService: First request structure:`, {
                requestKeys: Object.keys(firstRequest),
                hasSla: !!firstRequest.sla,
                hasActualCompletion: !!firstRequest.actual_completion_date,
                sla: firstRequest.sla,
                actual_completion_date: firstRequest.actual_completion_date
            });
        }

        // Получаем статистику SLA и просроченных заявок через SQL запросы
        const slaStats = await RequestGroup.findAll({
            attributes: [
                [fn('AVG', literal(`EXTRACT(EPOCH FROM "requests"."actual_completion_date" - "RequestGroup"."date_submitted") / 60`)), 'avgSlaMinutes'],
                [fn('COUNT', literal(`CASE WHEN "RequestGroup"."status" = 'completed' AND "RequestGroup"."date_submitted" IS NOT NULL AND "requests"."sla" IS NOT NULL THEN 1 END`)), 'completedWithSla']
            ],
            include: [{
                model: Request,
                as: 'requests',
                attributes: [],
                where: literal(`"RequestGroup"."status" = 'completed' AND "RequestGroup"."date_submitted" IS NOT NULL AND "requests"."sla" IS NOT NULL`)
            }],
            raw: true
        });

        // Просроченные заявки = завершенные заявки, которые превысили SLA
        const overdueStats = await RequestGroup.findAll({
            attributes: [
                [fn('COUNT', literal(`DISTINCT "RequestGroup"."id"`)), 'overdueCount']
            ],
            include: [{
                model: Request,
                as: 'requests',
                attributes: [],
                where: literal(`"RequestGroup".status = 'completed' AND sla IS NOT NULL AND "RequestGroup".date_submitted IS NOT NULL AND "requests"."actual_completion_date" IS NOT NULL AND (
                    CASE 
                        WHEN sla LIKE '%h' THEN "RequestGroup".date_submitted + (REPLACE(sla, 'h', '') || ' hours')::interval
                        WHEN sla LIKE '%d' THEN "RequestGroup".date_submitted + (REPLACE(sla, 'd', '') || ' days')::interval
                        WHEN sla LIKE '%w' THEN "RequestGroup".date_submitted + (REPLACE(sla, 'w', '') || ' weeks')::interval
                        ELSE "RequestGroup".date_submitted + (sla || ' minutes')::interval
                    END
                ) < "requests"."actual_completion_date"`)
            }],
            raw: true
        });

        // Собираем все заявки из групп
        const data = dataGroups.flatMap(group => group.requests || []);

        console.log(`AnalyticService: Found ${dataGroups.length} groups`);
        console.log(`AnalyticService: Found ${data.length} requests`);
        

        
        // Анализируем статусы заявок и групп
        const requestStatusCounts = {};
        const groupStatusCounts = {};
        
        data.forEach(r => {
            requestStatusCounts[r.status] = (requestStatusCounts[r.status] || 0) + 1;
        });
        
        dataGroups.forEach(g => {
            groupStatusCounts[g.status] = (groupStatusCounts[g.status] || 0) + 1;
        });
        
        const completedGroupsCount = dataGroups.filter(g => g.status === 'completed').length;
        
        console.log(`AnalyticService: Request status counts:`, requestStatusCounts);
        console.log(`AnalyticService: Group status counts:`, groupStatusCounts);
        console.log(`AnalyticService: Completed groups: ${completedGroupsCount}`);
        console.log(`AnalyticService: Sample request:`, data[0] ? {
            id: data[0].id,
            status: data[0].status,
            actual_completion_date: data[0].actual_completion_date,
            sla: data[0].sla,
            ratings: data[0].ratings
        } : 'No requests');

        const workbook = new ExcelJS.Workbook();

        // Summary
        const getAverage = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const calcStats = (items) => {
            // Получаем данные групп для доступа к date_submitted и статусу
            const itemsWithGroups = items.map(item => {
                const group = dataGroups.find(g => g.requests?.some(r => r.id === item.id));
                return { ...item, group };
            });
            
            // Используем статус группы для определения завершенных заявок
            const completed = itemsWithGroups.filter(i => i.group?.status === 'completed');
            
            // Получаем рейтинги из связанной таблицы
            const ratingList = items
                .map(i => {
                    const itemData = i.dataValues || i;
                    return itemData.ratings && itemData.ratings.length > 0 ? itemData.ratings[0].rating : null;
                })
                .filter(r => r != null && r > 0);

            const rating = getAverage(ratingList);
            
            // Рассчитываем SLA для завершенных заявок с полными данными
            const slaList = completed
                .filter(i => {
                    // Получаем данные из Sequelize объекта
                    const itemData = i.dataValues || i;
                    const groupData = i.group?.dataValues || i.group;
                    
                    const hasSla = itemData.sla && itemData.sla !== '';
                    const hasDateSubmitted = groupData && groupData.date_submitted;
                    const hasCompletionDate = itemData.actual_completion_date;
                    return hasSla && hasDateSubmitted && hasCompletionDate;
                })
                .map(i => {
                    // Получаем данные из Sequelize объекта
                    const itemData = i.dataValues || i;
                    const groupData = i.group?.dataValues || i.group;
                    
                    const timeDiff = new Date(itemData.actual_completion_date) - new Date(groupData.date_submitted);
                    return Math.round(timeDiff / 1000 / 60); // конвертируем в минуты
                })
                .filter(minutes => !isNaN(minutes) && minutes >= 0);
            
            const avgSla = slaList.length > 0 ? getAverage(slaList) : 0;
            
            // Рассчитываем просроченные заявки - только завершенные заявки, которые превысили SLA
            const overdue = completed.filter(i => {
                // Получаем данные из Sequelize объекта
                const itemData = i.dataValues || i;
                const groupData = i.group?.dataValues || i.group;
                
                if (!itemData.sla || !groupData?.date_submitted || !itemData.actual_completion_date) return false;
                
                const slaMinutes = parseSlaToMinutes(itemData.sla);
                if (slaMinutes <= 0) return false;
                
                const expected = new Date(groupData.date_submitted).getTime() + slaMinutes * 60000;
                const actual = new Date(itemData.actual_completion_date).getTime();
                
                return actual > expected;
            });
            
            console.log(`AnalyticService: Group stats - ${items.length} total, ${completed.length} completed, ${slaList.length} with SLA, ${overdue.length} overdue`);
            
            // Дополнительная отладка для понимания структуры данных
            if (completed.length > 0) {
                const firstCompleted = completed[0];
                const itemData = firstCompleted.dataValues || firstCompleted;
                const groupData = firstCompleted.group?.dataValues || firstCompleted.group;
                
                console.log(`AnalyticService: Sample completed item:`, {
                    id: itemData.id,
                    sla: itemData.sla,
                    date_submitted: groupData?.date_submitted,
                    actual_completion_date: itemData.actual_completion_date,
                    slaMinutes: itemData.sla ? parseSlaToMinutes(itemData.sla) : null
                });
                
                console.log(`AnalyticService: First completed item structure:`, {
                    itemKeys: Object.keys(firstCompleted),
                    hasSla: !!itemData.sla,
                    hasDateSubmitted: !!groupData?.date_submitted,
                    hasActualCompletion: !!itemData.actual_completion_date,
                    groupKeys: firstCompleted.group ? Object.keys(firstCompleted.group) : 'No group'
                });
            }
            
            return { count: items.length, sla: avgSla, rating, overdue: overdue.length };
        };

        // Используем SQL статистику для основной сводки
        const avgSla = slaStats[0]?.avgSlaMinutes ? Math.round(parseFloat(slaStats[0].avgSlaMinutes)) : 0;
        const overdueCount = overdueStats[0]?.overdueCount ? parseInt(overdueStats[0].overdueCount, 10) : 0;
        
        // Рассчитываем рейтинги для основной сводки
        const allRatings = data
            .map(i => i.ratings && i.ratings.length > 0 ? i.ratings[0].rating : null)
            .filter(r => r != null && r > 0);
        const avgRating = allRatings.length > 0 ? Math.round(allRatings.reduce((a, b) => a + b, 0) / allRatings.length) : 0;
        
        const summary = { 
            count: data.length, 
            sla: avgSla, 
            rating: avgRating, 
            overdue: overdueCount 
        };
        
        console.log(`AnalyticService: Summary - ${summary.count} total, ${summary.sla} avg SLA, ${summary.rating} avg rating, ${summary.overdue} overdue`);
        console.log(`AnalyticService: SLA Stats:`, slaStats);
        console.log(`AnalyticService: Overdue Stats:`, overdueStats);
        console.log(`AnalyticService: Applied filters:`, filters);
        
        // Дополнительная отладочная информация
        console.log(`AnalyticService: Overdue count from SQL: ${overdueStats[0]?.overdueCount || 0}`);
        console.log(`AnalyticService: SLA count from SQL: ${slaStats[0]?.completedWithSla || 0}`);
        const summarySheet = workbook.addWorksheet("Сводка");
        summarySheet.addRows([
            ["Метрика", "Значение"],
            ["Общее количество заявок", summary.count],
            ["Среднее время SLA (мин)", summary.sla || 0],
            ["Средняя оценка", summary.rating || 0],
            ["Просроченные заявки", summary.overdue || 0]
        ]);
        summarySheet.getRow(1).font = { bold: true };

        // Groupings
        const groupings = {
            "По офисам": {},
            "По исполнителям": {},
            "По категориям": {},
            "По датам": {}
        };

        for (const group of dataGroups) {
            const requests = group.requests || [];
            
            for (const r of requests) {
                // Получаем исполнителя из связанной таблицы
                const executor = r.requestExecutors && r.requestExecutors.length > 0 
                    ? r.requestExecutors[0].executor?.user?.full_name || `ID: ${r.requestExecutors[0].executor_id}`
                    : 'Не назначен';
                
                const keys = {
                    "По офисам": group.office_id || 'Неизвестно',
                    "По исполнителям": executor,
                    "По категориям": r.category_id || 'Без категории',
                    "По датам": r.created_date ? new Date(r.created_date).toLocaleDateString('ru-RU') : 'Неизвестно'
                };

                for (const key in groupings) {
                    if (!groupings[key][keys[key]]) groupings[key][keys[key]] = [];
                    groupings[key][keys[key]].push(r);
                }
            }
        }

        for (const [sheetName, groupData] of Object.entries(groupings)) {
            const hasData = Object.values(groupData).some(list => list.length > 0);
            if (!hasData) continue;
            const sheet = workbook.addWorksheet(sheetName.replace(/[\]*\\?:]/g, '').slice(0, 31));
            sheet.addRow(["Объект", "Заявки", "Среднее SLA (мин)", "Средняя оценка", "Просрочено"]);
            sheet.getRow(1).font = { bold: true };
            for (const [entity, items] of Object.entries(groupData)) {
                const { count, sla, rating, overdue } = calcStats(items);
                sheet.addRow([String(entity), count, sla || 0, rating || 0, overdue || 0]);
            }
        }

        // Raw sheet
        const rawSheet = workbook.addWorksheet("Сырые данные");
        const headers = [
            'ID', 'Тип запроса', 'Заголовок', 'Описание', 'Клиент ID',
            'Офис ID', 'Детали локации', 'Статус', 'Категория ID', 'Сложность',
            'SLA(минут)', 'Исполнитель ID', 'План ID', 'Фактическая дата завершения',
            'Причина отклонения', 'Комментарий', 'Дата подачи', 'Локация',
            'Дата создания', 'Оценка'
        ];
        rawSheet.addRow(headers);
        rawSheet.getRow(1).font = { bold: true };

        for (const group of dataGroups) {
            const requests = group.requests || [];
                         for (const r of requests) {
                 const values = [
                     r.id, group.request_type, r.title, r.description, group.client_id,
                     group.office_id, group.location_detail, r.status, r.category_id, r.complexity,
                     parseSlaToMinutes(r.sla),
                     r.requestExecutors && r.requestExecutors.length > 0 ? r.requestExecutors[0].executor_id : '', r.plan_id,
                     r.actual_completion_date ? new Date(r.actual_completion_date).toLocaleDateString('ru-RU') : '',
                     r.rejection_reason, r.comment,
                     group.date_submitted ? new Date(group.date_submitted).toLocaleDateString('ru-RU') : '',
                     group.location,
                     r.created_date ? new Date(r.created_date).toLocaleDateString('ru-RU') : '',
                     r.ratings && r.ratings.length > 0 ? r.ratings[0].rating : ''
                 ];
                 rawSheet.addRow(values);
             }
        }

        return await workbook.xlsx.writeBuffer();
    }
}

export default AnalyticService;
