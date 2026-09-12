import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import ClientRoomSubscriptionService from "../services/clientRoomSubscription.service.js";

class ClientRoomSubscriptionController {
    static createSubscription = asyncHandler(async (req, res) => {
        const { client_id, meeting_room_id } = req.body;
        const data = await ClientRoomSubscriptionService.create(client_id, meeting_room_id);
        res.status(201).json({
            success: true,
            message: 'Client subscribed to room successfully',
            data
        });
    });

    static deleteSubscription = asyncHandler(async (req, res) => {
        const { id } = req.params;
        await ClientRoomSubscriptionService.deleteById(Number(id));
        res.json({
            success: true,
            message: 'Subscription deleted successfully'
        });
    });

    static getAllSubscriptions = asyncHandler(async (req, res) => {
        const subscriptions = await ClientRoomSubscriptionService.getAll();
        res.json({
            success: true,
            subscriptions
        });
    });

    static getClientSubscriptions = asyncHandler(async (req, res) => {
        const { client_id } = req.params;
        const subscriptions = await ClientRoomSubscriptionService.getByClientId(client_id);
        res.json({
            success: true,
            subscriptions
        });
    });

    static getRoomSubscriptions = asyncHandler(async (req, res) => {
        const { meeting_room_id } = req.params;
        const subscriptions = await ClientRoomSubscriptionService.getByMeetingRoomId(meeting_room_id);
        res.json({
            success: true,
            subscriptions
        });
    });
}

export default ClientRoomSubscriptionController;
