import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import SupportTicketService from '../services/supportTicket.service.js';
import { BadRequestError } from '../errors/errors.js';

const SUPPORT_ADMIN_ROLE = 'admin-worker';

export const createTicket = asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
        throw new BadRequestError('message is required');
    }
    const ticket = await SupportTicketService.createTicket(req.user.id, message.trim());
    res.status(201).json({ ticket: ticket.toJSON ? ticket.toJSON() : ticket });
});

export const getTickets = asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user;
    const tickets = role === SUPPORT_ADMIN_ROLE
        ? await SupportTicketService.getAllTicketsForAdmin(userId)
        : await SupportTicketService.getMyTickets(userId);
    const list = tickets.map((t) => {
        const j = t.toJSON ? t.toJSON() : t;
        if (j.client) j.client_name = j.client?.full_name;
        if (j.assignedAdmin) j.assigned_admin_name = j.assignedAdmin?.full_name;
        return j;
    });
    res.json({ tickets: list });
});

export const getTicketMessages = asyncHandler(async (req, res) => {
    const ticketId = parseInt(req.params.ticketId, 10);
    const messages = await SupportTicketService.getMessages(
        ticketId,
        req.user.id,
        req.user.role
    );
    res.json({ messages });
});

export const postTicketMessage = asyncHandler(async (req, res) => {
    const ticketId = parseInt(req.params.ticketId, 10);
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
        throw new BadRequestError('message is required');
    }
    const sender = req.user.role === SUPPORT_ADMIN_ROLE ? 'admin' : 'user';
    const msg = await SupportTicketService.addMessage(
        ticketId,
        sender,
        req.user.id,
        message.trim(),
        req.user.role
    );
    res.status(201).json({ message: msg });
});
