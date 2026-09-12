import ExecutorService from '../services/executor.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { NotFoundError } from '../errors/errors.js';

class ExecutorController {
    static getAllExecutors = asyncHandler(async (req, res) => {
        const categoryId = req.query.categoryId
            ? Number.parseInt(String(req.query.categoryId), 10)
            : null;
        const officeIdOverride = req.query.office_id
            ? Number.parseInt(String(req.query.office_id), 10)
            : null;
        const executors = await ExecutorService.getAllExecutorsForDepartmentHead(
            req.user.id,
            Number.isNaN(categoryId) ? null : categoryId,
            Number.isNaN(officeIdOverride) ? null : officeIdOverride
        );
        res.json(executors);
    });

    static getAllExecutorsForManager = asyncHandler(async (req, res) => {
        const executors = await ExecutorService.getAllExecutorsForManager(req.user.id);
        res.json(executors);
    });

    static getAverageRating = asyncHandler(async (req, res) => {
        const rating = await ExecutorService.getAverageRatingByExecutorId(req.user.id);
        res.json({ id: req.user.id, average_rating: rating.toFixed(2) });
    });

    static getExecutorById = asyncHandler(async (req, res) => {
        const executor = await ExecutorService.getExecutorById(Number.parseInt(req.params.id, 10));
        if (!executor) {
            throw new NotFoundError('Executor not found');
        }
        res.json(executor);
    });

    static getExecutorByUserId = asyncHandler(async (req, res) => {
        const executor = await ExecutorService.getExecutorByUserId(Number.parseInt(req.params.id, 10));
        if (!executor) {
            throw new NotFoundError('Executor not found');
        }
        res.json(executor);
    });

    static createExecutor = asyncHandler(async (req, res) => {
        const newExecutor = await ExecutorService.createExecutor(req.user.id, req.body);
        res.status(201).json(newExecutor);
    });

    static updateExecutor = asyncHandler(async (req, res) => {
        const updatedExecutor = await ExecutorService.updateExecutor(
            Number.parseInt(req.params.id, 10),
            req.body,
            req.user.id
        );
        res.json(updatedExecutor);
    });

    static deleteExecutor = asyncHandler(async (req, res) => {
        await ExecutorService.deleteExecutor(Number.parseInt(req.params.id, 10), req.user.id);
        res.status(204).send();
    });
}

export default ExecutorController;
