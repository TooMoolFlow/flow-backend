import { Router } from 'express';
import { postChat } from '../controllers/chat.controller.js';

const router = Router();

// Открытый эндпоинт: чат-бот доступен без авторизации (в т.ч. для гостевого демо-режима)
router.post('/', postChat);

export default router;
