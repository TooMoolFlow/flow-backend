import { ClientRating, RequestGroup, User } from '../models/init.model.js';
import RatingLogService from './ratingLog.service.js';
import NotificationService from './notification.service.js';
import { NotFoundError, BadRequestError } from '../errors/errors.js';
import logger from '../utils/winston/logger.js';

function validateRatingInput(rating, comment) {
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        throw new BadRequestError('Оценка должна быть от 1 до 5');
    }
    if (rating < 4 && !comment) {
        throw new BadRequestError('Для оценки меньше 4 звезд необходимо указать причину');
    }
}

/**
 * Создать или обновить рейтинг клиента по request_group_id (client_id резолвится в сервисе).
 */
export const createClientRating = async (rated_by, request_group_id, rating, comment = null) => {
    validateRatingInput(rating, comment);
    const request = await RequestGroup.findByPk(request_group_id);
    if (!request) {
        throw new NotFoundError('Группа заявок не найдена');
    }
    const client_id = request.client_id;
    const existing = await ClientRating.findOne({
        where: { request_group_id, rated_by }
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
                ratingType: 'client_rating',
                ratingId: existing.id,
                userId: rated_by,
                actionType: 'updated',
                actionDescription: `Обновлен рейтинг клиента для группы заявок ${request_group_id}`,
                oldValues,
                newValues: { rating, comment }
            });
            logger.debug('Лог обновления рейтинга создан');
        } catch (error) {
            logger.error('Ошибка при создании лога обновления рейтинга', { error: error?.message });
            // Не прерываем выполнение, если логирование не удалось
        }

        if (rating < 4) {
            Promise.resolve(
                NotificationService.sendNotificationToManagers(
                    `Низкая оценка клиента`,
                    `Клиент создавший заявку №${request.id} получила низкую оценку (${rating} ★). 
                    Причина: ${comment || "Комментарий отсутствует"}.`
                )
            );
        }
        
        return existing;
    }
    
    const newRating = await ClientRating.create({
        rated_by,
        client_id,
        request_group_id,
        rating,
        comment
    });
    
    // Логируем создание
    try {
        await RatingLogService.createRatingLog({
            ratingType: 'client_rating',
            ratingId: newRating.id,
            userId: rated_by,
            actionType: 'created',
            actionDescription: `Создан рейтинг клиента для группы заявок ${request_group_id}`,
            newValues: { rating, comment }
        });
        logger.debug('Лог рейтинга создан');
    } catch (error) {
        logger.error('Ошибка при создании лога рейтинга', { error: error?.message });
        // Не прерываем выполнение, если логирование не удалось
    }

    if (rating < 4) {
        Promise.resolve(
            NotificationService.sendNotificationToManagers(
                `Низкая оценка клиента`,
                `Клиент создавший заявку №${request.id} получила низкую оценку (${rating} ★). 
                    Причина: ${comment || "Комментарий отсутствует"}.`
            )
        );
    }
    
    return newRating;
};

export const updateClientRating = async (rated_by, request_group_id, rating, comment = null) => {
    validateRatingInput(rating, comment);
    const request = await RequestGroup.findByPk(request_group_id);
    if (!request) {
        throw new NotFoundError('Группа заявок не найдена');
    }
    const existing = await ClientRating.findOne({
        where: { request_group_id, rated_by }
    });

    if (!existing) {
        throw new NotFoundError("Рейтинг клиента не найден для обновления.");
    }

    const oldValues = {
        rating: existing.rating,
        comment: existing.comment
    };

    await existing.update({ rating, comment });
    
    // Логируем обновление
    try {
        await RatingLogService.createRatingLog({
            ratingType: 'client_rating',
            ratingId: existing.id,
            userId: rated_by,
            actionType: 'updated',
            actionDescription: `Обновлен рейтинг клиента для группы заявок ${request_group_id}`,
            oldValues,
            newValues: { rating, comment }
        });
        logger.debug('Лог обновления рейтинга создан');
    } catch (error) {
        logger.error('Ошибка при создании лога обновления рейтинга', { error: error?.message });
        // Не прерываем выполнение, если логирование не удалось
    }

    if (rating < 4) {
        Promise.resolve(
            NotificationService.sendNotificationToManagers(
                `Низкая оценка клиента`,
                `Клиент создавший заявку №${request.id} получила низкую оценку (${rating} ★). 
                    Причина: ${comment || "Комментарий отсутствует"}.`
            )
        );
    }
    
    return existing;
};

export const getClientRatingsByExecutor = async (userId) => {
    const ratings = await ClientRating.findAll({
        where: { rated_by: userId },
        include: [
            {
                model: User,
                as: 'ratedClient',
                attributes: ['id', 'full_name', 'phone']
            },
            {
                model: RequestGroup,
                as: 'requestGroup',
                attributes: ['id', 'status', 'request_type']
            }
        ],
        order: [['created_at', 'DESC']],
        raw: true,
        nest: true
    });

    return ratings;
};

export const getClientRatingsByClient = async (userId) => {
    const ratings = await ClientRating.findAll({
        where: { client_id: userId },
        include: [
            {
                model: User,
                as: 'ratedByUser',
                attributes: ['id', 'full_name']
            },
            {
                model: RequestGroup,
                as: 'requestGroup',
                attributes: ['id', 'status', 'request_type']
            }
        ],
        order: [['created_at', 'DESC']],
        raw: true,
        nest: true
    });

    return ratings;
};

export const getClientRatingByRequestGroup = async (request_group_id, rated_by) => {
    const rating = await ClientRating.findOne({
        where: { request_group_id, rated_by }
    });
    if (!rating) {
        throw new NotFoundError('Рейтинг не найден');
    }
    return rating;
};

export const getAverageClientRating = async (client_id) => {
    const result = await ClientRating.findOne({
        where: { client_id },
        attributes: [
            [ClientRating.sequelize.fn('AVG', ClientRating.sequelize.col('rating')), 'average_rating'],
            [ClientRating.sequelize.fn('COUNT', ClientRating.sequelize.col('id')), 'total_ratings']
        ],
        raw: true
    });

    return {
        average_rating: parseFloat(result?.average_rating || 0).toFixed(2),
        total_ratings: parseInt(result?.total_ratings || 0)
    };
};

export const deleteClientRating = async (id, userId = null) => {
    const rating = await ClientRating.findByPk(id);
    if (!rating) {
        throw new NotFoundError('Рейтинг не найден для удаления');
    }
    
    const oldValues = {
        rating: rating.rating,
        comment: rating.comment,
        rated_by: rating.rated_by,
        client_id: rating.client_id,
        request_group_id: rating.request_group_id
    };
    
    await rating.destroy();
    
    // Логируем удаление
    if (userId) {
        try {
            await RatingLogService.createRatingLog({
                ratingType: 'client_rating',
                ratingId: id,
                userId: userId,
                actionType: 'deleted',
                actionDescription: `Удален рейтинг клиента ID: ${id}`,
                oldValues
            });
            logger.debug('Лог удаления рейтинга создан');
        } catch (error) {
            logger.error('Ошибка при создании лога удаления рейтинга', { error: error?.message });
            // Не прерываем выполнение, если логирование не удалось
        }
    }
    
    return rating;
};
