import express from 'express';
import RegistrationRequestController from '../controllers/registrationRequest.controller.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {CreateRequestDto, UpdateRequestDto} from "../dto/user.dto.js";

const router = express.Router();

// Публичный endpoint для создания запроса
router.post('/', validateBody(CreateRequestDto), RegistrationRequestController.createRequest);

// Защищенные endpoints для админов и менеджеров
router.use(authenticateToken, authorizeRoles('admin-worker', 'manager', 'department-head'));

// Получение списка запросов
router.get('/', RegistrationRequestController.getRequests);

// Тест пуша «новая регистрация» (только авторизованный admin-worker / manager → на себя)
router.post('/test-push', RegistrationRequestController.testRegistrationPush);

// Одобрение запроса
router.put('/:requestId/approve', RegistrationRequestController.approveRequest);

// Отклонение запроса
router.put('/:requestId/reject', RegistrationRequestController.rejectRequest);

// Удаление отклонённого запроса
router.delete('/:requestId', RegistrationRequestController.deleteRejectedRequest);

// Обновление данных запроса
router.put('/:requestId', validateBody(UpdateRequestDto), RegistrationRequestController.updateRequest);

export default router;
