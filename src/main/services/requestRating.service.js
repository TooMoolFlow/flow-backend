import {RequestRating, Request, RequestExecutor, RequestGroup} from "../models/init.model.js";
import {Op} from "sequelize";
import ExecutorService from "../services/executor.service.js"
import RatingLogService from "./ratingLog.service.js";
import NotificationService from "./notification.service.js";
import { BadRequestError, NotFoundError } from '../errors/errors.js';
import logger from '../utils/winston/logger.js';
export const createRating = async (rated_by, request_id, rating, comment = null) => {
    const request = await Request.findByPk(request_id, {
        include: [{ model: RequestGroup, as: "requestGroup" }]
    });
    if (!request) {
        throw new NotFoundError(`Request ${request_id} not found`);
    }
    const existing = await RequestRating.findOne({
        where: { request_id, rated_by }
    });

    if (existing) {
        // Если рейтинг уже существует, обновляем его
        const oldValues = {
            rating: existing.rating,
            comment: existing.comment
        };
        
        await existing.update({ rating, comment });
        
        // Логируем обновление
        try {
            await RatingLogService.createRatingLog({
                ratingType: 'request_rating',
                ratingId: existing.id,
                userId: rated_by,
                actionType: 'updated',
                actionDescription: `Обновлен рейтинг заявки ${request_id}`,
                oldValues,
                newValues: { rating, comment }
            });
            logger.debug('Лог обновления рейтинга заявки создан');
        } catch (error) {
            logger.error('Ошибка при создании лога обновления рейтинга заявки', { error: error?.message });
        }

        if (rating < 4) {
            Promise.resolve(
                NotificationService.sendNotificationToManagers(
                    `Низкая оценка исполнителя`,
                    `Исполнитель завершивший под заявку №${request.id} из группы заявок №${request.requestGroup.id} получила низкую оценку (${rating} ★). 
                    Причина: ${comment || "Комментарий отсутствует"}.`
                )
            );
        }
        
        return existing;
    }
    
    const newRating = await RequestRating.create({
        rated_by,
        request_id,
        rating,
        comment
    });
    
    // Логируем создание
    try {
        await RatingLogService.createRatingLog({
            ratingType: 'request_rating',
            ratingId: newRating.id,
            userId: rated_by,
            actionType: 'created',
            actionDescription: `Создан рейтинг заявки ${request_id}`,
            newValues: { rating, comment }
        });
        logger.debug('Лог создания рейтинга заявки создан');
    } catch (error) {
        logger.error('Ошибка при создании лога рейтинга заявки', { error: error?.message });
    }

    if (rating < 4) {
        Promise.resolve(
            NotificationService.sendNotificationToManagers(
                `Низкая оценка подзаявки #${request.id} из группы #${request.requestGroup.id}`,
                `Подзаявка №${request.id} из группы заявок №${request.requestGroup.id} получила низкую оценку (${rating} ★). 
                    Причина: ${comment || "Комментарий отсутствует"}.`
            )
        );
    }
    
    return newRating;
};

export const updateRating = async (rated_by, request_id, rating, comment = null) => {
    const existing = await RequestRating.findOne({
        where: { request_id, rated_by }
    });

    if (!existing) {
        throw new NotFoundError("Рейтинг не найден для обновления.");
    }

    const oldValues = {
        rating: existing.rating,
        comment: existing.comment
    };

    await existing.update({ rating, comment });
    
    // Логируем обновление
    try {
        await RatingLogService.createRatingLog({
            ratingType: 'request_rating',
            ratingId: existing.id,
            userId: rated_by,
            actionType: 'updated',
            actionDescription: `Обновлен рейтинг заявки ${request_id}`,
            oldValues,
            newValues: { rating, comment }
        });
        logger.debug('Лог обновления рейтинга заявки создан');
    } catch (error) {
        logger.error('Ошибка при создании лога обновления рейтинга заявки', { error: error?.message });
    }
    
    return existing;
};

export const getAllRatings = async () => {
    return await RequestRating.findAll();
};
export const getRatingsByExecutor = async (userId) => {
    const executor = await ExecutorService.getExecutorByUserId(userId)
    if (!executor) return []
    const requests = await Request.findAll({
        include: [{
            model: RequestExecutor,
            as: 'requestExecutors',
            where: { executor_id: executor.id },
            attributes: []
        }],
        where: { status: 'completed' },
        attributes: ['id'],
        raw: true
    });

    const requestIds = requests.map(req => req.id)
    if (requestIds.length === 0) return []

    // Получаем все рейтинги для заявок исполнителя
    const allRatings = await RequestRating.findAll({
        where: {
            request_id: {
                [Op.in]: requestIds
            }
        },
        attributes: [
            'request_id',
            'rating',
            'comment',
            'rated_by'
        ],
        raw: true
    });

    // Группируем рейтинги по request_id
    const ratingsByRequest = {};
    allRatings.forEach(rating => {
        if (!ratingsByRequest[rating.request_id]) {
            ratingsByRequest[rating.request_id] = {
                request_id: rating.request_id,
                ratings: [],
                comments: []
            };
        }
        ratingsByRequest[rating.request_id].ratings.push(rating.rating);
        if (rating.comment) {
            ratingsByRequest[rating.request_id].comments.push(rating.comment);
        }
    });

    // Вычисляем средний рейтинг и возвращаем все комментарии
    return Object.values(ratingsByRequest).map(item => ({
        request_id: item.request_id,
        rating: parseFloat((item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length).toFixed(0)),
        comments: item.comments, // Все комментарии для этой заявки
    }));
}

export const getRatingsByRequest = async (requestId) => {
    if (!requestId) {
        throw new BadRequestError("ID заявки обязателен");
    }

    // Проверяем, что заявка существует и завершена
    const request = await Request.findOne({
        where: { 
            id: requestId,
            status: 'completed'
        },
        attributes: ['id'],
        raw: true
    });

    if (!request) {
        return [];
    }

    // Получаем все рейтинги для данной заявки
    const allRatings = await RequestRating.findAll({
        where: {
            request_id: requestId
        },
        attributes: [
            'request_id',
            'rating',
            'comment',
            'rated_by'
        ],
        raw: true
    });

    if (allRatings.length === 0) return [];

    // Группируем рейтинги по request_id (в данном случае это будет одна заявка)
    const ratingsByRequest = {};
    allRatings.forEach(rating => {
        if (!ratingsByRequest[rating.request_id]) {
            ratingsByRequest[rating.request_id] = {
                request_id: rating.request_id,
                ratings: [],
                comments: []
            };
        }
        ratingsByRequest[rating.request_id].ratings.push(rating.rating);
        if (rating.comment) {
            ratingsByRequest[rating.request_id].comments.push(rating.comment);
        }
    });

    // Вычисляем средний рейтинг и возвращаем все комментарии
    return Object.values(ratingsByRequest).map(item => ({
        request_id: item.request_id,
        rating: parseFloat((item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length).toFixed(0)),
        comments: item.comments, // Все комментарии для этой заявки
    }));
}

export const  getRatingsByUser= async (userId,id)=> {
    return await RequestRating.findAll({
        where: {
            rated_by: userId,
            request_id: id
        }
    });
}
export const getRatingById = async (id) => {
    return await RequestRating.findByPk(id);
};

export const deleteRating = async (id, userId = null) => {
    const rating = await RequestRating.findByPk(id);
    if (!rating) return null;
    
    const oldValues = {
        rating: rating.rating,
        comment: rating.comment,
        rated_by: rating.rated_by,
        request_id: rating.request_id
    };
    
    await rating.destroy();
    
    // Логируем удаление
    if (userId) {
        try {
            await RatingLogService.createRatingLog({
                ratingType: 'request_rating',
                ratingId: id,
                userId: userId,
                actionType: 'deleted',
                actionDescription: `Удален рейтинг заявки ID: ${id}`,
                oldValues
            });
            logger.debug('Лог удаления рейтинга заявки создан');
        } catch (error) {
            logger.error('Ошибка при создании лога удаления рейтинга заявки', { error: error?.message });
        }
    }
    
    return rating;
};
