import fcmService from '../services/fcm.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { AppError, BadRequestError } from '../errors/errors.js';

function failIfNotSuccess(result, message = 'Operation failed') {
    if (!result.success) {
        throw new BadRequestError(result.message || message);
    }
}

class FCMController {
    saveToken = asyncHandler(async (req, res) => {
        const { token, platform = 'android', deviceId } = req.body;
        if (!token) throw new BadRequestError('Token is required');
        const result = await fcmService.saveToken(req.user.id, token, platform, deviceId);
        failIfNotSuccess(result, 'Failed to save token');
        res.status(200).json(result);
    });

    deleteToken = asyncHandler(async (req, res) => {
        const { token } = req.body;
        if (!token) throw new BadRequestError('Token is required');
        const result = await fcmService.deleteToken(token);
        failIfNotSuccess(result, 'Failed to delete token');
        res.status(200).json(result);
    });

    sendToUser = asyncHandler(async (req, res) => {
        const { userId, title, body, data } = req.body;
        if (!userId || !title || !body) throw new BadRequestError('userId, title and body are required');
        const result = await fcmService.sendToUser(userId, title, body, data);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    sendToToken = asyncHandler(async (req, res) => {
        const { token, title, body, data } = req.body;
        if (!token || !title || !body) throw new BadRequestError('token, title and body are required');
        const result = await fcmService.sendToToken(token, title, body, data);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    sendToTopic = asyncHandler(async (req, res) => {
        const { topic, title, body, data } = req.body;
        if (!topic || !title || !body) throw new BadRequestError('topic, title and body are required');
        const result = await fcmService.sendToTopic(topic, title, body, data);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    sendMulticast = asyncHandler(async (req, res) => {
        const { tokens, title, body, data } = req.body;
        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) throw new BadRequestError('tokens array is required');
        if (!title || !body) throw new BadRequestError('title and body are required');
        const result = await fcmService.sendMulticast(tokens, title, body, data);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    subscribeToTopic = asyncHandler(async (req, res) => {
        const { tokens, topic } = req.body;
        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) throw new BadRequestError('tokens array is required');
        if (!topic) throw new BadRequestError('topic is required');
        const result = await fcmService.subscribeToTopic(tokens, topic);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    unsubscribeFromTopic = asyncHandler(async (req, res) => {
        const { tokens, topic } = req.body;
        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) throw new BadRequestError('tokens array is required');
        if (!topic) throw new BadRequestError('topic is required');
        const result = await fcmService.unsubscribeFromTopic(tokens, topic);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    getUserTokens = asyncHandler(async (req, res) => {
        const result = await fcmService.getUserTokens(req.user.id);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    getTokenStats = asyncHandler(async (req, res) => {
        const result = await fcmService.getTokenStats();
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    sendTestNotification = asyncHandler(async (req, res) => {
        const { token } = req.body;
        if (!token) throw new BadRequestError('Token is required');
        const result = await fcmService.sendToToken(
            token,
            'Тестовое уведомление',
            'Это тестовое push-уведомление от Workflow Service',
            { type: 'test', timestamp: new Date().toISOString() }
        );
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    validateToken = asyncHandler(async (req, res) => {
        const { token } = req.body;
        if (!token) throw new BadRequestError('Token is required');
        const result = await fcmService.validateToken(token);
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    cleanupInvalidTokens = asyncHandler(async (req, res) => {
        const result = await fcmService.cleanupInvalidTokens();
        failIfNotSuccess(result);
        res.status(200).json(result);
    });

    getVAPIDKey = asyncHandler(async (req, res) => {
        const vapidPublicKey = fcmService.getVAPIDPublicKey();
        if (!vapidPublicKey) {
            throw new AppError('VAPID key not configured on server', 503);
        }
        res.status(200).json({ success: true, key: vapidPublicKey });
    });
}

export default new FCMController();
