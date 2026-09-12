import RequestExecutorService from '../services/requestExecutor.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/errors.js';

class RequestExecutorController {
    static assignExecutorsToRequest = asyncHandler(async (req, res) => {
        const { executors } = req.body;
        if (!executors || !Array.isArray(executors) || executors.length === 0) {
            throw new BadRequestError('executor_ids array is required');
        }
        const result = await RequestExecutorService.assignExecutorsToRequest(
            Number.parseInt(req.params.id, 10),
            executors,
            req.user.id,
            req
        );
        res.status(201).json(result);
    });

    static changeExecutorsForRequest = asyncHandler(async (req, res) => {
        const { executors } = req.body;
        if (!executors || !Array.isArray(executors) || executors.length === 0) {
            throw new BadRequestError('executor_ids array is required');
        }
        const assignments = await RequestExecutorService.changeExecutorsForRequest(req.params.id, executors, req.user.id, req);
        res.status(200).json(assignments);
    });
}

export default RequestExecutorController;
