import express from 'express';
import RequestExecutorController from '../controllers/requestExecutor.controller.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.middleware.js';

const router = express.Router();

// Назначить исполнителей на заявку
router.post('/:id/assign',
    authenticateToken,
    authorizeRoles('department-head'),
    RequestExecutorController.assignExecutorsToRequest
);

// Изменить исполнителей заявки
router.put('/:id/change',
    authenticateToken,
    authorizeRoles('department-head'),
    RequestExecutorController.changeExecutorsForRequest
);

export default router;
