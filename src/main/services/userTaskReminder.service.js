import { Op } from 'sequelize';

import logger from '../utils/winston/logger.js';
import UserTask from '../models/userTask.model.js';
import UserTaskAssignee from '../models/userTaskAssignee.model.js';
import UserTaskReminderLog from '../models/userTaskReminderLog.model.js';
import { Team } from '../models/team.model.js';
import { User } from '../models/user.model.js';
import NotificationService from './notification.service.js';
import pLimit from 'p-limit';

/**
 * Sends push reminders for user tasks.
 *
 * Rules (MVP, per task.txt):
 * - If task has scheduled_at (calendar time) → push at that time.
 * - If task has deadline_to + deadline_time → push at (deadline - 2 days) and (deadline - 1 day). (Optional at deadline not enabled.)
 * - If task has explicit remind_at (from push action) → push at remind_at (overrides).
 *
 * Dedupe rule: one reminder per (task_id, user_id, remind_at), persisted in `user_task_reminder_logs`.
 * Time window: ±2 minutes around now (to tolerate cron drift).
 */
export default class UserTaskReminderService {
  static buildTimeWindow(now) {
    return {
      from: new Date(now.getTime() - 60 * 1000),
      to: new Date(now.getTime() + 60 * 1000),
    };
  }

  static buildDayKeys(now) {
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const plus2 = new Date(now);
    plus2.setDate(plus2.getDate() + 2);
    return {
      nowKey: dayKey(now),
      plus2Key: dayKey(plus2),
    };
  }

  static async loadDueTasks({ from, to, nowKey, plus2Key }) {
    return UserTask.findAll({
      where: {
        completed: false,
        reminders_disabled: false,
        [Op.or]: [
          { remind_at: { [Op.between]: [from, to] } },
          { scheduled_at: { [Op.between]: [from, to] } },
          { remind_before_minutes: { [Op.not]: null } },
          { deadline_to: { [Op.between]: [nowKey, plus2Key] } },
        ],
      },
      attributes: [
        'id',
        'creator_id',
        'executor_id',
        'team_id',
        'title',
        'priority',
        'remind_at',
        'remind_before_minutes',
        'scheduled_at',
        'deadline_to',
        'deadline_time',
      ],
      order: [['updated_at', 'DESC']],
      limit: 200,
    });
  }

  static async loadAssignees(taskIds) {
    const rows = await UserTaskAssignee.findAll({
      where: { user_task_id: { [Op.in]: taskIds } },
      attributes: ['user_task_id', 'user_id'],
    });

    const map = new Map();
    for (const row of rows) {
      const list = map.get(row.user_task_id) ?? [];
      list.push(row.user_id);
      map.set(row.user_task_id, list);
    }

    return { rows, map };
  }

  static async loadTeamMembersMap(teamIds) {
    const map = new Map();
    const ids = [...new Set(teamIds.filter((id) => id != null))];
    if (!ids.length) return map;

    const teams = await Team.findAll({
      where: { id: ids },
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id'],
          through: { attributes: [] },
        },
      ],
    });

    for (const team of teams) {
      const memberIds = new Set([Number(team.leader_id), ...(team.members || []).map((m) => Number(m.id))]);
      map.set(
        team.id,
        Array.from(memberIds).filter(Number.isFinite)
      );
    }
    return map;
  }

  static resolveReminderRecipients(task, assigneesByTask, teamMembersMap) {
    const assignees = assigneesByTask.get(task.id) ?? [];
    if (assignees.length > 0) return Array.from(new Set(assignees));
    if (task.team_id) {
      const teamMembers = teamMembersMap.get(task.team_id);
      if (teamMembers?.length) return teamMembers;
    }
    if (task.executor_id) return [task.executor_id];
    return [task.creator_id];
  }

  static buildSentMap(existingLogs) {
    const sentMap = new Map();

    for (const log of existingLogs) {
      const taskMap = sentMap.get(log.user_task_id) ?? new Map();
      const userSet = taskMap.get(log.user_id) ?? new Set();
      userSet.add(new Date(log.remind_at).toISOString());
      taskMap.set(log.user_id, userSet);
      sentMap.set(log.user_task_id, taskMap);
    }

    return sentMap;
  }

  static getTriggers(task) {
    const triggers = [];

    if (task.remind_at) triggers.push(new Date(task.remind_at));
    else if (typeof task.remind_before_minutes === 'number') {
      const referenceDate = task.scheduled_at
        ? new Date(task.scheduled_at)
        : (task.deadline_to && task.deadline_time
          ? new Date(`${task.deadline_to}T${task.deadline_time}:00.000Z`)
          : null);

      if (referenceDate) {
        triggers.push(new Date(referenceDate.getTime() - task.remind_before_minutes * 60 * 1000));
      }
    } else if (task.scheduled_at) {
      triggers.push(new Date(task.scheduled_at));
    } else if (task.deadline_to && task.deadline_time) {
      const deadlineAt = new Date(`${task.deadline_to}T${task.deadline_time}:00.000Z`);
      triggers.push(new Date(deadlineAt.getTime() - 48 * 60 * 60 * 1000));
      triggers.push(new Date(deadlineAt.getTime() - 24 * 60 * 60 * 1000));
    }

    return triggers;
  }

  static async sendDueReminders(now = new Date()) {
    const { from, to } = this.buildTimeWindow(now);
    const { nowKey, plus2Key } = this.buildDayKeys(now);

    const dueTasks = await this.loadDueTasks({ from, to, nowKey, plus2Key });

    if (dueTasks.length === 0) return { remindersSent: 0 };

    // Load assignees (for team tasks)
    const taskIds = dueTasks.map((t) => t.id);
    const { rows: assigneeRows, map: assigneesByTask } = await this.loadAssignees(taskIds);
    const teamIds = dueTasks.map((t) => t.team_id).filter((id) => id != null);
    const teamMembersMap = await this.loadTeamMembersMap(teamIds);

    // Preload all sent reminder logs for these tasks (batch to avoid N+1)
    const allRecipients = new Set();
    assigneeRows.forEach((r) => allRecipients.add(r.user_id));
    dueTasks.forEach((t) => {
      for (const uid of this.resolveReminderRecipients(t, assigneesByTask, teamMembersMap)) {
        allRecipients.add(uid);
      }
    });

    const existingLogs = await UserTaskReminderLog.findAll({
      where: {
        user_task_id: { [Op.in]: taskIds },
        user_id: { [Op.in]: Array.from(allRecipients) },
        status: 'sent',
      },
      attributes: ['user_task_id', 'user_id', 'remind_at'],
    });

    // Map: taskId -> userId -> Set(remind_at ISO)
    const sentMap = this.buildSentMap(existingLogs);

    let remindersSent = 0;
    const limit = pLimit(10);
    const logsToInsert = [];

    for (const task of dueTasks) {
      const triggers = this.getTriggers(task);

      // Only triggers that are due now
      const dueTriggers = triggers.filter((t) => t >= from && t <= to);
      if (dueTriggers.length === 0) continue;

      const recipients = this.resolveReminderRecipients(task, assigneesByTask, teamMembersMap);

      for (const triggerAt of dueTriggers) {
        const remindAtIso = triggerAt.toISOString();
        const taskMap = sentMap.get(task.id) ?? new Map();

        const results = await Promise.allSettled(
          recipients.map((userId) =>
            limit(async () => {
            const userSet = taskMap.get(userId);
            if (userSet && userSet.has(remindAtIso)) return null;

            try {
              const isHighPriority = task.priority === 'high';
              const title = isHighPriority ? 'Срочно: важная задача' : 'Напоминание';
              const body = isHighPriority ? `Высокий приоритет: ${task.title}` : task.title;
              const data = {
                type: 'task_reminder',
                category: 'task_reminder',
                priority: task.priority || 'medium',
                task_id: String(task.id),
                remind_at: remindAtIso,
              };

              await NotificationService.sendPushNotification(userId, title, body, data);

              return {
                type: 'success',
                log: {
                  user_task_id: task.id,
                  user_id: userId,
                  remind_at: triggerAt,
                  sent_at: now,
                  status: 'sent',
                  error: null,
                  created_at: now,
                },
              };
            } catch (error) {
              logger.error('Failed to send task reminder', {
                error: error?.message,
                taskId: task.id,
                userId,
              });

              return {
                type: 'failed',
                log: {
                  user_task_id: task.id,
                  user_id: userId,
                  remind_at: triggerAt,
                  sent_at: now,
                  status: 'failed',
                  error: error?.message || 'Unknown error',
                  created_at: now,
                },
              };
            }
            })
          )
        );

        for (const res of results) {
          if (!res || res.status !== 'fulfilled' || !res.value) continue;

          logsToInsert.push(res.value.log);

          if (res.value.type === 'success') {
            remindersSent++;
          }
        }
      }
    }

    if (logsToInsert.length > 0) {
      try {
        await UserTaskReminderLog.bulkCreate(logsToInsert, {
          ignoreDuplicates: true,
        });
      } catch (e) {
        logger.error('Failed to bulk insert reminder logs', {
          error: e?.message,
        });
      }
    }

    if (remindersSent > 0) {
      logger.info('User task reminders sent', { count: remindersSent });
    }

    return { remindersSent };
  }
}
