import { User } from './user.model.js';
import { Office } from './office.model.js';
import { OfficeLocationCatalog } from './officeLocationCatalog.model.js';
import { Executor } from './executor.model.js';
import { ExecutorServiceCategory } from './executorServiceCategory.model.js';
import { Request } from './request.model.js';
import { RequestGroup } from './requestGroup.model.js';
import { RequestExecutor } from './requestExecutor.model.js';
import { ServiceCategory } from './serviceCategory.model.js';
import { ServiceSubcategory } from './serviceSubcategory.model.js';
import { RequestPhoto } from './requestPhoto.model.js';
import { RequestComment } from './requestComment.model.js';
import {Plan} from "./plan.model.js";
import {RequestRating} from "./requestRating.model.js";
import {Notification} from "./notification.model.js";
import ClientRating from "./clientRating.model.js";
import {RequestLog} from "./requestLog.model.js";
import {RecurringTaskInstance} from "./recurringTaskInstance.model.js";
import {RatingLog} from "./ratingLog.model.js";
import {NotificationLog} from "./notificationLog.model.js";
import { RegistrationRequest } from './registrationRequest.model.js';
import { MeetingRoom } from './meetingRoom.model.js';
import { MeetingRoomBooking } from './meetingRoomBooking.model.js';
import { MeetingRoomBookingLog } from './meetingRoomBookingLog.model.js';
import { YandexSmartHomeToken } from './yandexSmartHomeToken.model.js';
import { MeetingRoomDevice } from './meetingRoomDevice.model.js';
import { ClientRoomSubscription } from './clientRoomSubscription.model.js';
import { VerificationCode } from './verificationCode.model.js';
import { SupportTicket } from './supportTicket.model.js';
import { SupportTicketMessage } from './supportTicketMessage.model.js';
import { UserStepsDaily } from './userStepsDaily.model.js';
import { HealthyProfile } from './healthyProfile.model.js';
import { HealthyMetricDaily } from './healthyMetricDaily.model.js';
import { HealthyRecommendationContent } from './healthyRecommendationContent.model.js';
import { HealthyInsightSnapshot } from './healthyInsightSnapshot.model.js';
import { HealthyGenerationLog } from './healthyGenerationLog.model.js';
import { News } from './news.model.js';
import { NewsView } from './newsView.model.js';
import { NewsReaction } from './newsReaction.model.js';
import { MeetingRoomPhoto } from './meetingRoomPhoto.model.js';
import { UserTask } from './userTask.model.js';
import { UserTaskAssignee } from './userTaskAssignee.model.js';
import { UserTaskAttachment } from './userTaskAttachment.model.js';
import { UserTaskReminderLog } from './userTaskReminderLog.model.js';
import { Team } from './team.model.js';
import { TeamMember } from './teamMember.model.js';
import { Company } from './company.model.js';

// Office ↔ Users
Office.hasMany(User, { foreignKey: 'office_id' , as: 'users'});
User.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

// Office ↔ Companies (компании-арендаторы внутри офиса)
Office.hasMany(Company, { foreignKey: 'office_id', as: 'companies' });
Company.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

// Company ↔ Users (только клиенты привязываются к компании; SET NULL при удалении компании)
Company.hasMany(User, { foreignKey: 'company_id', as: 'clients' });
User.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Executor ↔ User
User.hasOne(Executor, { foreignKey: 'user_id' , as: 'executor' });
Executor.belongsTo(User, { foreignKey: 'user_id' , as: 'user' });

// Executor ↔ ServiceCategory (many-to-many)
Executor.belongsToMany(ServiceCategory, {
  through: ExecutorServiceCategory,
  foreignKey: 'executor_id',
  otherKey: 'category_id',
  as: 'serviceCategories',
});
ServiceCategory.belongsToMany(Executor, {
  through: ExecutorServiceCategory,
  foreignKey: 'category_id',
  otherKey: 'executor_id',
  as: 'executors',
});
Executor.hasMany(ExecutorServiceCategory, {
  foreignKey: 'executor_id',
  as: 'executorCategories',
});
ExecutorServiceCategory.belongsTo(Executor, { foreignKey: 'executor_id', as: 'executor' });
ExecutorServiceCategory.belongsTo(ServiceCategory, {
  foreignKey: 'category_id',
  as: 'category',
});

// UserTask ↔ User (creator + assignees)
User.hasMany(UserTask, { foreignKey: 'creator_id', as: 'createdTasks' });
UserTask.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

UserTask.belongsToMany(User, {
  through: UserTaskAssignee,
  foreignKey: 'user_task_id',
  otherKey: 'user_id',
  as: 'assignees',
});
User.belongsToMany(UserTask, {
  through: UserTaskAssignee,
  foreignKey: 'user_id',
  otherKey: 'user_task_id',
  as: 'assignedUserTasks',
});

// UserTask ↔ attachments
UserTask.hasMany(UserTaskAttachment, { foreignKey: 'user_task_id', as: 'attachments' });
UserTaskAttachment.belongsTo(UserTask, { foreignKey: 'user_task_id', as: 'task' });

User.hasMany(UserTask, { foreignKey: 'executor_id', as: 'executedTasks' });
UserTask.belongsTo(User, { foreignKey: 'executor_id', as: 'executor' });

User.hasMany(UserTask, { foreignKey: 'completed_by', as: 'completedUserTasks' });
UserTask.belongsTo(User, { foreignKey: 'completed_by', as: 'completedByUser' });

// Team ↔ User (leader, creator)
User.hasMany(Team, { foreignKey: 'leader_id', as: 'ledTeams' });
Team.belongsTo(User, { foreignKey: 'leader_id', as: 'leader' });

User.hasMany(Team, { foreignKey: 'created_by', as: 'createdTeams' });
Team.belongsTo(User, { foreignKey: 'created_by', as: 'teamCreator' });

Team.belongsToMany(User, {
  through: TeamMember,
  foreignKey: 'team_id',
  otherKey: 'user_id',
  as: 'members',
});
User.belongsToMany(Team, {
  through: TeamMember,
  foreignKey: 'user_id',
  otherKey: 'team_id',
  as: 'teams',
});

// UserTask ↔ Team
Team.hasMany(UserTask, { foreignKey: 'team_id', as: 'userTasks' });
UserTask.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });

// Reminder logs (for dedupe/debug)
UserTaskReminderLog.belongsTo(UserTask, { foreignKey: 'user_task_id', as: 'task' });
UserTaskReminderLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserTask.hasMany(UserTaskReminderLog, { foreignKey: 'user_task_id', as: 'reminderLogs' });

// RequestGroup ↔ User (client)
User.hasMany(RequestGroup, { foreignKey: 'client_id', as: 'clientRequestGroups' });
RequestGroup.belongsTo(User, { foreignKey: 'client_id', as: 'client' });

// RequestGroup ↔ Office
Office.hasMany(RequestGroup, { foreignKey: 'office_id', as: 'requestGroups' });
RequestGroup.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

// Office ↔ location catalog (шаблоны блок / этаж / помещение)
Office.hasMany(OfficeLocationCatalog, { foreignKey: 'office_id', as: 'locationCatalog' });
OfficeLocationCatalog.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

// RequestGroup ↔ Request (подзаявки)
RequestGroup.hasMany(Request, { foreignKey: 'request_group_id', as: 'requests' });
Request.belongsTo(RequestGroup, { foreignKey: 'request_group_id', as: 'requestGroup' });

// Request ↔ RequestExecutor ↔ Executor (многие-ко-многим)
Request.belongsToMany(Executor, {
    through: RequestExecutor,
    foreignKey: 'request_id',
    otherKey: 'executor_id',
    as: 'executors'
});
Executor.belongsToMany(Request, {
    through: RequestExecutor,
    foreignKey: 'executor_id',
    otherKey: 'request_id',
    as: 'requests'
});

// RequestExecutor associations
Request.hasMany(RequestExecutor, { as: 'requestExecutors', foreignKey: 'request_id' });
RequestExecutor.belongsTo(Request, { foreignKey: 'request_id', as: 'Request' });

// RequestExecutor → Executor
RequestExecutor.belongsTo(Executor, { as: 'executor', foreignKey: 'executor_id' });
Executor.hasMany(RequestExecutor, { as: 'requestExecutors', foreignKey: 'executor_id' });

// ServiceCategory ↔ Request
ServiceCategory.hasMany(Request, { foreignKey: 'category_id', as: 'requests' });
Request.belongsTo(ServiceCategory, { foreignKey: 'category_id', as: 'category' });

// ServiceSubcategory ↔ Request
ServiceSubcategory.hasMany(Request, { foreignKey: 'subcategory_id', as: 'requests' });
Request.belongsTo(ServiceSubcategory, { foreignKey: 'subcategory_id', as: 'subcategory' });

// ServiceCategory ↔ ServiceSubcategory
ServiceCategory.hasMany(ServiceSubcategory, { foreignKey: 'category_id', as: 'subcategories' });
ServiceSubcategory.belongsTo(ServiceCategory, { foreignKey: 'category_id', as: 'category' });

// RequestGroup ↔ RequestPhoto (фото привязаны к группе заявок)
RequestGroup.hasMany(RequestPhoto, { foreignKey: 'request_id' , as: 'photos' });
RequestPhoto.belongsTo(RequestGroup, { foreignKey: 'request_id', as: 'requestGroup' });

// Request ↔ RequestComment
Request.hasMany(RequestComment, { foreignKey: 'request_id', as: 'comments' });
RequestComment.belongsTo(Request, { foreignKey: 'request_id', as: 'request' });

// User ↔ RequestComment (sender)
User.hasMany(RequestComment, { foreignKey: 'sender_id', as: 'comments' });
RequestComment.belongsTo(User, { foreignKey: 'sender_id', as: 'user' });

Plan.belongsTo(User, { foreignKey: 'department_id', as: 'departmentUser' });
Plan.belongsTo(Office, { foreignKey: 'office_id' });

RequestRating.belongsTo(Request, { foreignKey: 'request_id', unique: true});
Request.hasMany(RequestRating, { foreignKey: 'request_id', as: 'ratings' });
RequestRating.belongsTo(User, { foreignKey: 'rated_by', as: 'ratedByUser' });

Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

// Уведомления теперь относятся только к группам заявок
Notification.belongsTo(RequestGroup, { foreignKey: 'request_id', as: 'request' });
RequestGroup.hasMany(Notification, { foreignKey: 'request_id', as: 'notifications' });

User.belongsTo(ServiceCategory, { foreignKey: 'service_category_id', as: 'service_category'});
ServiceCategory.hasMany(User, { foreignKey: 'service_category_id', as: 'users'});

// RequestLog associations
RequestLog.belongsTo(RequestGroup, { foreignKey: 'request_id', as: 'request' });
RequestGroup.hasMany(RequestLog, { foreignKey: 'request_id', as: 'logs' });

RequestLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(RequestLog, { foreignKey: 'user_id', as: 'logs' });

// RecurringTaskInstance associations
RecurringTaskInstance.belongsTo(RequestGroup, { foreignKey: 'request_group_id', as: 'recurringTaskGroup' });
RequestGroup.hasMany(RecurringTaskInstance, { foreignKey: 'request_group_id', as: 'taskInstances' });

RecurringTaskInstance.belongsTo(User, { foreignKey: 'completed_by', as: 'taskCompletedByUser' });
User.hasMany(RecurringTaskInstance, { foreignKey: 'completed_by', as: 'completedTaskInstances' });

// ClientRating associations
ClientRating.belongsTo(User, { foreignKey: 'rated_by', as: 'ratedByUser' });
User.hasMany(ClientRating, { foreignKey: 'rated_by', as: 'clientRatingsGiven' });

ClientRating.belongsTo(User, { foreignKey: 'client_id', as: 'ratedClient' });
User.hasMany(ClientRating, { foreignKey: 'client_id', as: 'clientRatingsReceived' });

ClientRating.belongsTo(RequestGroup, { foreignKey: 'request_group_id', as: 'requestGroup' });
RequestGroup.hasMany(ClientRating, { foreignKey: 'request_group_id', as: 'clientRatings' });

// RegistrationRequest associations
Office.hasMany(RegistrationRequest, { foreignKey: 'office_id', as: 'registrationRequests' });
RegistrationRequest.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

// RegistrationRequest ↔ Company (если клиент при регистрации выбрал существующую компанию)
Company.hasMany(RegistrationRequest, { foreignKey: 'company_id', as: 'registrationRequests' });
RegistrationRequest.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// MeetingRoom associations
Office.hasMany(MeetingRoom, { foreignKey: 'office_id', as: 'meetingRooms' });
MeetingRoom.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

MeetingRoom.hasMany(MeetingRoomPhoto, { foreignKey: 'meeting_room_id', as: 'roomPhotos' });
MeetingRoomPhoto.belongsTo(MeetingRoom, { foreignKey: 'meeting_room_id', as: 'meetingRoom' });

// MeetingRoomBooking associations
MeetingRoom.hasMany(MeetingRoomBooking, { foreignKey: 'meeting_room_id', as: 'bookings' });
MeetingRoomBooking.belongsTo(MeetingRoom, { foreignKey: 'meeting_room_id', as: 'meetingRoom' });

Office.hasMany(MeetingRoomBooking, { foreignKey: 'office_id', as: 'meetingRoomBookings' });
MeetingRoomBooking.belongsTo(Office, { foreignKey: 'office_id', as: 'office' });

User.hasMany(MeetingRoomBooking, { foreignKey: 'client_id', as: 'meetingRoomBookings' });
MeetingRoomBooking.belongsTo(User, { foreignKey: 'client_id', as: 'client' });

MeetingRoomBooking.hasMany(MeetingRoomBookingLog, { foreignKey: 'booking_id', as: 'logs' });
MeetingRoomBookingLog.belongsTo(MeetingRoomBooking, { foreignKey: 'booking_id', as: 'booking' });

MeetingRoomBookingLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
User.hasMany(MeetingRoomBookingLog, { foreignKey: 'actor_id', as: 'meetingRoomBookingLogs' });

MeetingRoomBookingLog.belongsTo(MeetingRoom, { foreignKey: 'room_id', as: 'room' });
MeetingRoom.hasMany(MeetingRoomBookingLog, { foreignKey: 'room_id', as: 'bookingLogs' });

// YandexSmartHomeToken - не привязан к пользователям, работает как офис

// MeetingRoomDevice associations
MeetingRoom.hasMany(MeetingRoomDevice, { foreignKey: 'meeting_room_id', as: 'devices' });
MeetingRoomDevice.belongsTo(MeetingRoom, { foreignKey: 'meeting_room_id', as: 'meetingRoom' });

// ClientRoomSubscription associations
User.hasMany(ClientRoomSubscription, { foreignKey: 'client_id', as: 'roomSubscriptions' });
ClientRoomSubscription.belongsTo(User, { foreignKey: 'client_id', as: 'subscribedClient' });

MeetingRoom.hasMany(ClientRoomSubscription, { foreignKey: 'meeting_room_id', as: 'clientSubscriptions' });
ClientRoomSubscription.belongsTo(MeetingRoom, { foreignKey: 'meeting_room_id', as: 'meetingRoom' });

// Support tickets (client–admin chat)
User.hasMany(SupportTicket, { foreignKey: 'user_id', as: 'supportTickets' });
SupportTicket.belongsTo(User, { foreignKey: 'user_id', as: 'client' });
SupportTicket.belongsTo(User, { foreignKey: 'assigned_admin_id', as: 'assignedAdmin' });
User.hasMany(SupportTicket, { foreignKey: 'assigned_admin_id', as: 'assignedSupportTickets' });
SupportTicket.hasMany(SupportTicketMessage, { foreignKey: 'ticket_id', as: 'messages' });
SupportTicketMessage.belongsTo(SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });
SupportTicketMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'senderUser' });
User.hasMany(SupportTicketMessage, { foreignKey: 'sender_id', as: 'supportTicketMessages' });

// UserStepsDaily (шагомер: синк и пуш-уведомления)
User.hasMany(UserStepsDaily, { foreignKey: 'user_id', as: 'stepsDaily' });
UserStepsDaily.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Healthy module associations
User.hasOne(HealthyProfile, { foreignKey: 'user_id', as: 'healthyProfile' });
HealthyProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(HealthyMetricDaily, { foreignKey: 'user_id', as: 'healthyMetricsDaily' });
HealthyMetricDaily.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(HealthyInsightSnapshot, { foreignKey: 'user_id', as: 'healthyInsightSnapshots' });
HealthyInsightSnapshot.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(HealthyGenerationLog, { foreignKey: 'user_id', as: 'healthyGenerationLogs' });
HealthyGenerationLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// News associations
User.hasMany(News, { foreignKey: 'created_by', as: 'news' });
News.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

News.hasMany(NewsView, { foreignKey: 'news_id', as: 'views' });
NewsView.belongsTo(News, { foreignKey: 'news_id', as: 'news' });
User.hasMany(NewsView, { foreignKey: 'user_id', as: 'newsViews' });
NewsView.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

News.hasMany(NewsReaction, { foreignKey: 'news_id', as: 'reactions' });
NewsReaction.belongsTo(News, { foreignKey: 'news_id', as: 'news' });
User.hasMany(NewsReaction, { foreignKey: 'user_id', as: 'newsReactions' });
NewsReaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export {
    User,
    Request,
    RequestGroup,
    RequestExecutor,
    ServiceCategory,
    ServiceSubcategory,
    RequestComment,
    Office,
    OfficeLocationCatalog,
    Executor,
    ExecutorServiceCategory,
    RequestPhoto,
    Plan,
    RequestRating,
    Notification,
    RequestLog,
    RecurringTaskInstance,
    ClientRating,
    RatingLog,
    NotificationLog,
    RegistrationRequest,
    MeetingRoom,
    MeetingRoomBooking,
    MeetingRoomBookingLog,
    YandexSmartHomeToken,
    MeetingRoomDevice,
    ClientRoomSubscription,
    VerificationCode,
    SupportTicket,
    SupportTicketMessage,
    UserStepsDaily,
    HealthyProfile,
    HealthyMetricDaily,
    HealthyRecommendationContent,
    HealthyInsightSnapshot,
    HealthyGenerationLog,
    News,
    NewsView,
    NewsReaction,
    MeetingRoomPhoto,
    UserTask,
    UserTaskAssignee,
    UserTaskAttachment,
    UserTaskReminderLog,
    Team,
    TeamMember,
    Company,
}
