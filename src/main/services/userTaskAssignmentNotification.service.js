import { Team } from '../models/team.model.js';
import { User } from '../models/user.model.js';
import NotificationService from './notification.service.js';
import logger from '../utils/winston/logger.js';

/**
 * Push + in-app при назначении задачи на команду или исполнителя.
 */
export default class UserTaskAssignmentNotificationService {
  static async resolveTeamRecipientIds(teamId) {
    const team = await Team.findByPk(teamId, {
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id'],
          through: { attributes: [] },
        },
      ],
    });
    if (!team) return [];
    const ids = new Set([Number(team.leader_id), ...(team.members || []).map((m) => Number(m.id))]);
    return Array.from(ids).filter(Number.isFinite);
  }

  static async notifyRecipients({ task, creatorId, recipientIds }) {
    const unique = Array.from(
      new Set(recipientIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id !== Number(creatorId)))
    );
    if (unique.length === 0) return;

    const title = 'Новая задача';
    const body = typeof task.title === 'string' ? task.title : 'Задача';
    const pushData = {
      type: 'user_task_assigned',
      task_id: String(task.id),
      team_id: task.team_id != null ? String(task.team_id) : '',
      executor_id: task.executor_id != null ? String(task.executor_id) : '',
      timestamp: new Date().toISOString(),
    };

    await Promise.allSettled(
      unique.map(async (userId) => {
        try {
          await NotificationService.saveNotification(userId, title, body);
          await NotificationService.sendPushNotification(userId, title, body, pushData);
        } catch (err) {
          logger.error('user_task_assigned notification failed', {
            taskId: task.id,
            userId,
            error: err?.message,
          });
        }
      })
    );
  }

  /** После создания задачи с назначением */
  static async notifyOnCreate(task, creatorId) {
    if (!task.team_id && !task.executor_id) return;

    let recipientIds = [];
    if (task.team_id) {
      recipientIds = await this.resolveTeamRecipientIds(task.team_id);
    } else if (task.executor_id) {
      recipientIds = [task.executor_id];
    }

    await this.notifyRecipients({ task, creatorId, recipientIds });
  }

  /** После смены team_id / executor_id */
  static async notifyOnAssignmentChange(task, creatorId, { previousTeamId, previousExecutorId }) {
    const teamChanged = Number(previousTeamId ?? 0) !== Number(task.team_id ?? 0);
    const executorChanged = Number(previousExecutorId ?? 0) !== Number(task.executor_id ?? 0);
    if (!teamChanged && !executorChanged) return;
    if (!task.team_id && !task.executor_id) return;

    let recipientIds = [];
    if (task.team_id) {
      recipientIds = await this.resolveTeamRecipientIds(task.team_id);
    } else if (task.executor_id) {
      recipientIds = [task.executor_id];
    }

    await this.notifyRecipients({ task, creatorId, recipientIds });
  }
}
