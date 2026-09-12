import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import * as StepsService from '../services/steps.service.js';

class StepsController {
    static sync = asyncHandler(async (req, res) => {
        const result = await StepsService.syncSteps(req.user.id, req.body);
        res.status(200).json({ ok: true, data: result });
    });
}

export default StepsController;
