import * as ratingService from '../services/requestRating.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { getRatingsByRequest } from '../services/requestRating.service.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';

function validateRatingInput(rating, comment) {
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        throw new BadRequestError('Оценка должна быть от 1 до 5');
    }
    if (rating < 4 && !comment) {
        throw new BadRequestError('Для оценки меньше 4 звезд необходимо указать причину');
    }
}

export const createRequestRating = asyncHandler(async (req, res) => {
    const { rating, request_id, comment } = req.body;
    validateRatingInput(rating, comment ?? null);
    const newRating = await ratingService.createRating(req.user.id, request_id, rating, comment ?? null);
    res.status(201).json(newRating);
});

export const updateRequestRating = asyncHandler(async (req, res) => {
    const { rating, request_id, comment } = req.body;
    validateRatingInput(rating, comment ?? null);
    const updatedRating = await ratingService.updateRating(req.user.id, request_id, rating, comment ?? null);
    res.json(updatedRating);
});

export const getAllRequestRatings = asyncHandler(async (req, res) => {
    const ratings = await ratingService.getAllRatings();
    res.json(ratings);
});

export const getRequestRatingById = asyncHandler(async (req, res) => {
    const rating = await ratingService.getRatingById(Number(req.params.id));
    if (!rating) {
        throw new NotFoundError('Оценка не найдена');
    }
    res.json(rating);
});

export const getRequestRatingByExecutor = asyncHandler(async (req, res) => {
    const rating = await ratingService.getRatingsByExecutor(req.user.id);
    if (!rating) {
        throw new NotFoundError('Оценка не найдена');
    }
    res.json(rating);
});

export const getExecutorRatingsByRequest = asyncHandler(async (req, res) => {
    const requestId = req.params.requestId;
    if (!requestId) {
        throw new BadRequestError('ID заявки обязателен');
    }
    const ratings = await getRatingsByRequest(parseInt(requestId, 10));
    res.json({ success: true, data: ratings });
});
export const getRequestRatingByUser = asyncHandler(async (req, res) => {
    const rating = await ratingService.getRatingsByUser(req.user.id, req.params.id);
    if (!rating) {
        throw new NotFoundError('Оценка не найдена');
    }
    res.json(rating);
});

export const deleteRequestRating = asyncHandler(async (req, res) => {
    const deleted = await ratingService.deleteRating(Number(req.params.id), req.user.id);
    if (!deleted) {
        throw new NotFoundError('Оценка не найдена для удаления');
    }
    res.json({ message: 'Оценка успешно удалена' });
});
