import express from 'express';
import RequestGroupController from '../controllers/requestGroup.controller.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.middleware.js';
import {requireRequestGroupOfficeAccess} from '../middleware/departmentHeadOwnOffice.middleware.js';
import { commonUpload } from '../utils/multerUpload.js';

const router = express.Router();

// Создать новую группу заявок
router.post('/',
    authenticateToken,
    commonUpload.array('photos', 3),
    RequestGroupController.createRequestGroup
);

// Получить все группы заявок (с пагинацией)
router.get('/', authenticateToken, RequestGroupController.getAllRequestGroups);

// Получить группу заявок по ID
router.get('/:id', authenticateToken, RequestGroupController.getRequestGroupById);

// Удалить группу заявок
router.delete('/:id', authenticateToken, RequestGroupController.deleteRequestGroup);

// Принять / отклонить заявку: admin-worker — везде, department-head — только свой офис
router.patch('/:id',
    authenticateToken,
    authorizeRoles('admin-worker', 'department-head'),
    requireRequestGroupOfficeAccess,
    RequestGroupController.patchUpdateRequestGroup
);

// Обновить группу заявок (для админа и менеджера)
router.put('/:id',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    RequestGroupController.updateRequestGroup
);

export default router;
