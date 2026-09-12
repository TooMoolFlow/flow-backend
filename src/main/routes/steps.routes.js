import { Router } from 'express';
import StepsController from '../controllers/steps.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/sync', authenticateToken, StepsController.sync);

export default router;
