import express from 'express';

import TeamController from '../controllers/team.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, TeamController.list);
router.post('/', authenticateToken, TeamController.create);
router.get('/:id', authenticateToken, TeamController.getById);
router.patch('/:id', authenticateToken, TeamController.update);
router.put('/:id', authenticateToken, TeamController.update);
router.delete('/:id', authenticateToken, TeamController.remove);

export default router;
