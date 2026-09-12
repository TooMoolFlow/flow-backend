import { ClientRoomSubscription } from "../models/clientRoomSubscription.model.js";
import { User } from "../models/user.model.js";
import { MeetingRoom } from "../models/meetingRoom.model.js";
import { Office } from "../models/office.model.js";
import { BadRequestError, ConflictError, NotFoundError } from "../errors/errors.js";
import logger from "../utils/winston/logger.js";

const meetingRoomInclude = [
    {
        model: MeetingRoom,
        as: 'meetingRoom',
        attributes: ['id', 'name', 'office_id', 'room_type'],
        include: [{
            model: Office,
            as: 'office',
            attributes: ['id', 'name']
        }]
    }
];

const meetingRoomIncludeBasic = [
    {
        model: MeetingRoom,
        as: 'meetingRoom',
        attributes: ['id', 'name', 'office_id'],
        include: [{
            model: Office,
            as: 'office',
            attributes: ['id', 'name']
        }]
    }
];

const userInclude = [
    {
        model: User,
        as: 'subscribedClient',
        attributes: ['id', 'full_name', 'phone']
    }
];

class ClientRoomSubscriptionService {
    /**
     * Создать подписку пользователя на комнату.
     * @param {number} clientId
     * @param {number} meetingRoomId
     * @returns {Promise<Object>} подписка с отношениями
     */
    static async create(clientId, meetingRoomId) {
        if (!clientId || !meetingRoomId) {
            throw new BadRequestError('client_id and meeting_room_id are required');
        }

        const client = await User.findByPk(clientId);
        if (!client) {
            throw new NotFoundError('Client not found');
        }

        const room = await MeetingRoom.findByPk(meetingRoomId);
        if (!room) {
            throw new NotFoundError('Meeting room not found');
        }

        const existing = await ClientRoomSubscription.findOne({
            where: { client_id: clientId, meeting_room_id: meetingRoomId }
        });
        if (existing) {
            throw new ConflictError('Client is already subscribed to this room');
        }

        const subscription = await ClientRoomSubscription.create({
            client_id: clientId,
            meeting_room_id: meetingRoomId
        });

        logger.info('Client room subscription created', {
            subscriptionId: subscription.id,
            clientId,
            meetingRoomId
        });

        return ClientRoomSubscription.findByPk(subscription.id, {
            include: [
                ...userInclude,
                ...meetingRoomIncludeBasic
            ]
        });
    }

    /**
     * Удалить подписку по id.
     * @param {number} id
     */
    static async deleteById(id) {
        const subscription = await ClientRoomSubscription.findByPk(id);
        if (!subscription) {
            throw new NotFoundError('Subscription not found');
        }
        await subscription.destroy();
        logger.info('Client room subscription deleted', { subscriptionId: id });
    }

    /**
     * Получить все подписки (для админа).
     */
    static async getAll() {
        return ClientRoomSubscription.findAll({
            include: [
                ...userInclude,
                ...meetingRoomIncludeBasic
            ],
            order: [['created_at', 'DESC']]
        });
    }

    /**
     * Получить подписки по client_id (с room_type для фильтра кабинетов).
     * @param {number} clientId
     */
    static async getByClientId(clientId) {
        return ClientRoomSubscription.findAll({
            where: { client_id: clientId },
            include: meetingRoomInclude,
            order: [['created_at', 'DESC']]
        });
    }

    /**
     * Получить подписки по meeting_room_id.
     * @param {number} meetingRoomId
     */
    static async getByMeetingRoomId(meetingRoomId) {
        return ClientRoomSubscription.findAll({
            where: { meeting_room_id: meetingRoomId },
            include: userInclude,
            order: [['created_at', 'DESC']]
        });
    }
}

export default ClientRoomSubscriptionService;
