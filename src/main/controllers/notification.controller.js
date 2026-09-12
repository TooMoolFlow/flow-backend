import NotificationService from '../services/notification.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/errors.js';

class NotificationController {
    static getMyNotifications = asyncHandler(async (req, res) => {
        const userId = req.user.id;

        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        const notifications = await NotificationService.getNotificationsByUserId(
            userId,
            page,
            pageSize
        );

        res.json(notifications);
    });

    static markAsRead = asyncHandler(async (req, res) => {
      const id = req.params.id
      const userId = req.user.id
      const notification = await NotificationService.markAsRead(id, userId)
      res.json(notification)
  })

    static deleteNotification = asyncHandler(async (req, res) => {
      const id = req.params.id
      const userId = req.user.id
      await NotificationService.deleteNotification(id, userId)
      res.status(204).send()
  })

    static async handleRejectAssignedRequest(req, res) {
        const { request_id, reason } = req.body;
        const userId = req.user?.id;

        await NotificationService.handleRejectAssignedRequest(request_id, reason, userId);

        return res.status(200).json({ message: "Заявка возвращена на повторное назначение" });
    }

    static createHealthNotification = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const { message } = req.body;

        if (!message) {
            throw new BadRequestError('Message is required');
        }

        await NotificationService.saveNotification(
            userId,
            'Хелси - Напоминание',
            message
        );

        res.status(201).json({ 
            success: true, 
            message: 'Health notification saved successfully' 
        });
    });
}

export default NotificationController
