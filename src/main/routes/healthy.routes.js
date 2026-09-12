import { Router } from 'express';
import HealthyController from '../controllers/healthy.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  healthyInsightQuerySchema,
  healthyProfilePatchSchema,
  healthyRegenerateRequestSchema,
  healthySyncRequestSchema,
} from '../dto/healthy.dto.js';

const router = Router();

router.use(authenticateToken);

router.get('/profile', HealthyController.getProfile);
router.patch('/profile', validateRequest({ body: healthyProfilePatchSchema }), HealthyController.patchProfile);
router.post('/sync', validateRequest({ body: healthySyncRequestSchema }), HealthyController.sync);
router.get('/insights', validateRequest({ query: healthyInsightQuerySchema }), HealthyController.getInsights);
router.post('/regenerate', validateRequest({ body: healthyRegenerateRequestSchema }), HealthyController.regenerate);

export default router;

