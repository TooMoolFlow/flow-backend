import { SupportTicket, SupportTicketMessage, User } from '../models/init.model.js';
import { NotFoundError, ForbiddenError } from '../errors/errors.js';
import FCMService from './fcm.service.js';
import { Op } from 'sequelize';
import logger from '../utils/winston/logger.js';

const MESSAGE_LIMIT = 100;
const MESSAGE_DAYS_LIMIT = 30;

/**
 * Найти админа с наименьшим числом открытых тикетов (для распределения нагрузки).
 * MVP: если админ один — возвращаем его.
 */
async function findAdminWithFewestOpenTickets() {
    const admins = await User.findAll({
        where: { role: 'admin-worker' },
        attributes: ['id', 'full_name']
    });
    if (admins.length === 0) return null;

    const counts = await Promise.all(
        admins.map(async (admin) => {
            const count = await SupportTicket.count({
                where: {
                    assigned_admin_id: admin.id,
                    status: { [Op.in]: ['open', 'in_progress'] }
                }
            });
            return { admin, count };
        })
    );
    counts.sort((a, b) => a.count - b.count);
    return counts[0].admin;
}

/**
 * Создать тикет от клиента. Назначается админ с наименьшим числом чатов.
 */
async function createTicket(userId, message) {
    const admin = await findAdminWithFewestOpenTickets();
    const ticket = await SupportTicket.create({
        user_id: userId,
        assigned_admin_id: admin?.id ?? null,
        status: 'open'
    });
    await SupportTicketMessage.create({
        ticket_id: ticket.id,
        sender: 'user',
        sender_id: userId,
        message: message
    });

    if (admin) {
        try {
            const client = await User.findByPk(userId, { attributes: ['full_name'] });
            const clientName = client?.full_name || 'Клиент';
            await FCMService.sendToUser(admin.id, 'Новое сообщение от клиента', `Новое сообщение от клиента ${clientName}`, {
                type: 'support_message',
                ticket_id: String(ticket.id),
                url: `/admin-worker?tab=messages`
            });
        } catch (e) {
            logger.warn('Support ticket: push to admin failed', e.message);
        }
    }

    return ticket;
}

/**
 * Мои тикеты (для клиента).
 */
async function getMyTickets(userId) {
    return SupportTicket.findAll({
        where: { user_id: userId },
        include: [
            { model: User, as: 'assignedAdmin', attributes: ['id', 'full_name'] }
        ],
        order: [['updated_at', 'DESC']]
    });
}

/**
 * Все тикеты для админа (только чаты с клиентами, без бота).
 */
async function getAllTicketsForAdmin(adminId) {
    return SupportTicket.findAll({
        where: { assigned_admin_id: adminId },
        include: [
            { model: User, as: 'client', attributes: ['id', 'full_name'] }
        ],
        order: [['updated_at', 'DESC']]
    });
}

/**
 * История сообщений: последние 100 сообщений или за 30 дней (текст только, MVP).
 */
async function getMessages(ticketId, userId, userRole) {
    const ticket = await SupportTicket.findByPk(ticketId, {
        include: [
            { model: User, as: 'client', attributes: ['id', 'full_name'] },
            { model: User, as: 'assignedAdmin', attributes: ['id', 'full_name'] }
        ]
    });
    if (!ticket) throw new NotFoundError('Ticket not found');

    const isClient = userRole === 'client' || userRole === 'department-head' || userRole === 'manager';
    const isAdmin = userRole === 'admin-worker';
    if (isClient && ticket.user_id !== userId) throw new ForbiddenError('Access denied');
    if (isAdmin && ticket.assigned_admin_id !== userId) throw new ForbiddenError('Access denied');

    const since = new Date();
    since.setDate(since.getDate() - MESSAGE_DAYS_LIMIT);

    const messages = await SupportTicketMessage.findAll({
        where: {
            ticket_id: ticketId,
            created_at: { [Op.gte]: since }
        },
        include: [{ model: User, as: 'senderUser', attributes: ['id', 'full_name'] }],
        order: [['created_at', 'ASC']]
    });

    const limited = messages.slice(-MESSAGE_LIMIT);
    return limited.map((m) => ({
        id: m.id,
        ticket_id: m.ticket_id,
        sender: m.sender,
        message: m.message,
        created_at: m.created_at
    }));
}

/**
 * Добавить сообщение и отправить push сразу.
 * Клиенту: "Новое сообщение от поддержки"
 * Админу: "Новое сообщение от клиента [Имя]"
 */
async function addMessage(ticketId, sender, senderId, message, userRole) {
    const ticket = await SupportTicket.findByPk(ticketId, {
        include: [
            { model: User, as: 'client', attributes: ['id', 'full_name'] },
            { model: User, as: 'assignedAdmin', attributes: ['id', 'full_name'] }
        ]
    });
    if (!ticket) throw new NotFoundError('Ticket not found');

    const isClient = userRole === 'client' || userRole === 'department-head' || userRole === 'manager';
    const isAdmin = userRole === 'admin-worker';
    if (isClient && ticket.user_id !== senderId) throw new ForbiddenError('Access denied');
    if (isAdmin && ticket.assigned_admin_id !== senderId) throw new ForbiddenError('Access denied');

    const created = await SupportTicketMessage.create({
        ticket_id: ticketId,
        sender,
        sender_id: senderId,
        message
    });
    await ticket.update({ updated_at: new Date(), status: 'in_progress' });

    if (sender === 'admin') {
        try {
            await FCMService.sendToUser(ticket.user_id, 'Новое сообщение от поддержки', 'Новое сообщение от поддержки', {
                type: 'support_message',
                ticket_id: String(ticketId),
                url: '/chat-bot'
            });
        } catch (e) {
            logger.warn('Support message: push to client failed', e.message);
        }
    } else {
        const adminId = ticket.assigned_admin_id;
        if (adminId) {
            try {
                const clientName = ticket.client?.full_name || 'Клиент';
                await FCMService.sendToUser(adminId, 'Новое сообщение от клиента', `Новое сообщение от клиента ${clientName}`, {
                    type: 'support_message',
                    ticket_id: String(ticketId),
                    url: '/admin-worker?tab=messages'
                });
            } catch (e) {
                logger.warn('Support message: push to admin failed', e.message);
            }
        }
    }

    return {
        id: created.id,
        ticket_id: created.ticket_id,
        sender: created.sender,
        message: created.message,
        created_at: created.created_at
    };
}

export default {
    createTicket,
    getMyTickets,
    getAllTicketsForAdmin,
    getMessages,
    addMessage,
    findAdminWithFewestOpenTickets
};
