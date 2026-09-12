import * as clientRatingService from '../services/clientRating.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';

export const createClientRating = asyncHandler(async (req, res) => {
    const { rating, request_group_id, comment } = req.body;
    const newRating = await clientRatingService.createClientRating(
        req.user.id,
        request_group_id,
        rating,
        comment ?? null
    );
    res.status(201).json(newRating);
});

export const updateClientRating = asyncHandler(async (req, res) => {
    const { rating, request_group_id, comment } = req.body;
    const updatedRating = await clientRatingService.updateClientRating(
        req.user.id,
        request_group_id,
        rating,
        comment ?? null
    );
    res.json(updatedRating);
});

export const getClientRatingsByExecutor = asyncHandler(async (req, res) => {
    const ratings = await clientRatingService.getClientRatingsByExecutor(req.user.id);
    res.json(ratings);
});

export const getClientRatingsByClient = asyncHandler(async (req, res) => {
    const ratings = await clientRatingService.getClientRatingsByClient(req.user.id);
    res.json(ratings);
});

export const getClientRatingByRequestGroup = asyncHandler(async (req, res) => {
    const rating = await clientRatingService.getClientRatingByRequestGroup(
        req.params.request_group_id,
        req.user.id
    );
    res.json(rating);
});

export const getAverageClientRating = asyncHandler(async (req, res) => {
    const averageRating = await clientRatingService.getAverageClientRating(req.params.client_id);
    res.json(averageRating);
});

export const deleteClientRating = asyncHandler(async (req, res) => {
    await clientRatingService.deleteClientRating(req.params.id, req.user.id);
    res.json({ message: 'Рейтинг клиента успешно удален' });
});
