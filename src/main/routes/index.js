import authRoutes from './auth.routes.js';
import officeRoutes from './office.routes.js';
import userRoutes from './user.routes.js';
import requestRoutes from './request.routes.js';
import serviceCategoryRoutes from './serviceCategory.routes.js';
import executorRoutes from './executor.routes.js';
import requestPhotoRoutes from './requestPhoto.routes.js';
import requestCommentRoutes from './requestComment.routes.js';
import requestRatingRoutes from './requestRating.routes.js';
import clientRatingRoutes from './clientRating.routes.js';
import notificationRoutes from './notification.routes.js';
import fcmRoutes from './fcm.routes.js';
import analyticRoutes from './analytic.routes.js';
import departmentRoutes from './department.routes.js';
import requestLogRoutes from './requestLog.routes.js';
import requestGroupRoutes from './requestGroup.routes.js';
import requestExecutorRoutes from './requestExecutor.routes.js';
import recurringTaskRoutes from './recurringTask.routes.js';
import ratingLogRoutes from './ratingLog.routes.js';
import notificationLogRoutes from './notificationLog.routes.js';
import registrationRequestRoutes from './registrationRequest.routes.js';
import meetingRoomRoutes from './meetingRoom.routes.js';
import meetingRoomBookingRoutes from './meetingRoomBooking.routes.js';
import yandexSmartHomeRoutes from './yandexSmartHome.routes.js';
import clientRoomSubscriptionRoutes from './clientRoomSubscription.routes.js';
import contactRoutes from './contact.routes.js';
import chatRoutes from './chat.routes.js';
import supportTicketRoutes from './supportTicket.routes.js';
import stepsRoutes from './steps.routes.js';
import healthyRoutes from './healthy.routes.js';
import newsRoutes from './news.routes.js';
import userTaskRoutes from './userTask.routes.js';
import teamRoutes from './team.routes.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

/**
 * Mount all API routes on the Express app.
 * @param {import('express').Express} app
 */
export function registerRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/offices', officeRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/service-categories', serviceCategoryRoutes);
  app.use('/api/executors', executorRoutes);
  app.use('/api/request-photos', requestPhotoRoutes);
  app.use('/api/ratings', requestRatingRoutes);
  app.use('/api/client-ratings', clientRatingRoutes);
  app.use('/api/comments', requestCommentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/fcm', fcmRoutes);
  app.use('/api/analytics', authenticateToken, analyticRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/request-logs', requestLogRoutes);
  app.use('/api/request-groups', requestGroupRoutes);
  app.use('/api/request-executors', requestExecutorRoutes);
  app.use('/api/recurring-tasks', recurringTaskRoutes);
  app.use('/api/rating-logs', ratingLogRoutes);
  app.use('/api/notification-logs', notificationLogRoutes);
  app.use('/api/registration-requests', registrationRequestRoutes);
  app.use('/api/meeting-rooms', meetingRoomRoutes);
  app.use('/api/meeting-room-bookings', meetingRoomBookingRoutes);
  app.use('/api/yandex-smart-home', yandexSmartHomeRoutes);
  app.use('/api/client-room-subscriptions', clientRoomSubscriptionRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/support-tickets', supportTicketRoutes);
  app.use('/api/steps', stepsRoutes);
  app.use('/api/healthy', healthyRoutes);
  app.use('/api/news', newsRoutes);
  app.use('/api/user-tasks', userTaskRoutes);
  app.use('/api/teams', teamRoutes);
}
