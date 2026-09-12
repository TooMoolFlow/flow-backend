import { Router } from 'express';
import { authenticateToken, forbidRoles } from '../middleware/auth.middleware.js';
import {
    createTicket,
    getTickets,
    getTicketMessages,
    postTicketMessage
} from '../controllers/supportTicket.controller.js';

const router = Router();

router.use(authenticateToken);

// Создать тикет могут только не-админы (админы отвечают через раздел сообщений)
router.post('/', forbidRoles('admin-worker'), createTicket);
router.get('/', getTickets);
router.get('/:ticketId/messages', getTicketMessages);
router.post('/:ticketId/messages', postTicketMessage);

export default router;
