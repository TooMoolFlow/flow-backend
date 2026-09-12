import { Op, literal } from 'sequelize';

import { UserTask } from '../models/userTask.model.js';
import { UserTaskAssignee } from '../models/userTaskAssignee.model.js';
import { Team } from '../models/team.model.js';
import { TeamMember } from '../models/teamMember.model.js';
import { UserTaskAttachment } from '../models/userTaskAttachment.model.js';
import { User } from '../models/user.model.js';
import UserService from './user.service.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/errors.js';
import fs from 'fs/promises';
import path from 'path';
import { uploadToCloudinary, deleteFromCloudinaryByUrl } from '../utils/cloudinaryUpload.js';
import logger from '../utils/winston/logger.js';
import {
  parseRecurrenceFromBody,
  computeNextScheduledAfterNow,
} from '../utils/userTaskRecurrence.util.js';
import {
  buildViewWhereClauses,
  orderForView,
} from '../utils/userTaskListFilters.util.js';
import UserTaskAssignmentNotificationService from './userTaskAssignmentNotification.service.js';

function toInt(value, fallback) {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseAssigneeIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => toInt(x, NaN)).filter(Number.isFinite);
  if (typeof raw === 'string') {
    // allow "1,2,3" or JSON array
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((x) => toInt(x, NaN)).filter(Number.isFinite);
    } catch {
      // ignore
    }
    return trimmed
      .split(',')
      .map((x) => toInt(x.trim(), NaN))
      .filter(Number.isFinite);
  }
  return [];
}

function uniqueInts(list) {
  return Array.from(new Set(list.filter((x) => Number.isFinite(x))));
}

function yyyyMmDd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseOptionalFkInt(body, key) {
  if (body[key] === undefined) return undefined;
  if (body[key] === null || body[key] === '') return null;
  const n = toInt(body[key], NaN);
  if (!Number.isFinite(n)) throw new BadRequestError(`Некорректное значение: ${key}`);
  return n;
}

function normalizePriority(value, fallback = 'medium') {
  if (value == null) return fallback;
  if (typeof value !== 'string') throw new BadRequestError('Некорректный приоритет');
  const normalized = value.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') return normalized;
  throw new BadRequestError('Некорректный приоритет');
}

export default class UserTaskService {
  static taskDetailIncludes(light = false) {
    const teamInclude = light
      ? [{ model: User, as: 'leader', attributes: ['id', 'full_name'] }]
      : [
          { model: User, as: 'leader', attributes: ['id', 'full_name'] },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'full_name'],
            through: { attributes: [] },
          },
        ];

    return [
      {
        model: User,
        as: 'assignees',
        attributes: ['id', 'full_name'],
        through: { attributes: [] },
        required: false,
      },
      {
        model: Team,
        as: 'team',
        attributes: ['id', 'name', 'leader_id'],
        required: false,
        include: teamInclude,
      },
      {
        model: User,
        as: 'executor',
        attributes: ['id', 'full_name'],
        required: false,
      },
      {
        model: User,
        as: 'completedByUser',
        attributes: ['id', 'full_name'],
        required: false,
      },
    ];
  }

  /**
   * Взаимоисключающее назначение: либо team_id, либо executor_id (один исполнитель).
   */
  static _normalizeAssignmentFromBody(body, { creatorId, currentTeamId = null, currentExecutorId = null, isCreate = false }) {
    const hasTeam = body.team_id !== undefined;
    const hasExecutor = body.executor_id !== undefined;
    const hasAssignees = body.assignee_ids !== undefined;

    if (!hasTeam && !hasExecutor && !hasAssignees) {
      if (isCreate) {
        return { teamId: null, executorId: null, clearAssignees: false, touched: false };
      }
      return {
        teamId: currentTeamId,
        executorId: currentExecutorId,
        clearAssignees: false,
        touched: false,
      };
    }

    let teamId = hasTeam ? parseOptionalFkInt(body, 'team_id') : isCreate ? null : currentTeamId;
    let executorId = hasExecutor ? parseOptionalFkInt(body, 'executor_id') : isCreate ? null : currentExecutorId;
    let executorFromAssignees = false;

    if (hasAssignees) {
      const ids = uniqueInts(parseAssigneeIds(body.assignee_ids)).filter((id) => id !== creatorId);
      if (ids.length > 1) {
        throw new BadRequestError('Можно назначить только одного исполнителя');
      }
      if (ids.length === 1) {
        if (hasExecutor && executorId != null && executorId !== ids[0]) {
          throw new BadRequestError('Задача не может быть назначена одновременно команде и исполнителю');
        }
        executorId = ids[0];
        executorFromAssignees = true;
      } else {
        executorId = null;
        executorFromAssignees = true;
      }
    }

    const settingTeam = hasTeam && teamId != null;
    const settingExecutor =
      (hasExecutor && executorId != null) || (executorFromAssignees && executorId != null);

    if (settingTeam && settingExecutor) {
      throw new BadRequestError('Задача не может быть назначена одновременно команде и исполнителю');
    }

    if (settingTeam) {
      return { teamId, executorId: null, clearAssignees: true, touched: true };
    }

    if (settingExecutor || hasExecutor || executorFromAssignees) {
      if (executorId != null) teamId = null;
      return { teamId, executorId, clearAssignees: true, touched: true };
    }

    return { teamId, executorId, clearAssignees: hasExecutor || hasAssignees, touched: true };
  }

  static async _syncAssigneeRows(taskId, executorId, creatorId) {
    await UserTaskAssignee.destroy({ where: { user_task_id: taskId } });
    if (executorId != null && executorId !== creatorId) {
      await UserTaskAssignee.bulkCreate(
        [{ user_task_id: taskId, user_id: executorId }],
        { ignoreDuplicates: true }
      );
    }
  }

  static _accessWhere(userId) {
    const uid = Number(userId);
    return {
      [Op.or]: [
        { creator_id: uid },
        { executor_id: uid },
        { '$assignees.id$': uid },
        literal(
          `(EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = "UserTask"."team_id" AND tm.user_id = ${uid}))`
        ),
      ],
    };
  }

  static _canAccess(task, userId) {
    const uid = Number(userId);
    if (Number(task.creator_id) === uid) return true;
    if (Number(task.executor_id) === uid) return true;
    if (Array.isArray(task.assignees) && task.assignees.some((u) => Number(u.id) === uid)) return true;
    if (task.team_id) {
      const team = task.team;
      if (team) {
        if (Number(team.leader_id) === uid) return true;
        const members = team.members || [];
        if (members.some((m) => Number(m.id) === uid)) return true;
      }
    }
    return false;
  }

  /** Редактирование полей: создатель или руководитель команды (для задач с team_id). */
  static _canEditTaskDetails(task, userId) {
    const uid = Number(userId);
    if (Number(task.creator_id) === uid) return true;
    if (!task.team_id) return false;
    const team = task.team;
    if (team && Number(team.leader_id) === uid) return true;
    return false;
  }

  static async _canEditTaskDetailsAsync(task, userId) {
    if (this._canEditTaskDetails(task, userId)) return true;
    const uid = Number(userId);
    if (!task.team_id) return false;
    const team = await Team.findByPk(task.team_id, { attributes: ['leader_id'] });
    return team != null && Number(team.leader_id) === uid;
  }

  /** Доступ при неполной загрузке task.team (например, listAttachments). */
  static async _canAccessAsync(task, userId) {
    if (this._canAccess(task, userId)) return true;
    const teamId = task.team_id;
    if (teamId == null) return false;
    const uid = Number(userId);
    const member = await TeamMember.findOne({
      where: { team_id: teamId, user_id: uid },
      attributes: ['user_id'],
    });
    if (member) return true;
    const team = await Team.findByPk(teamId, { attributes: ['leader_id'] });
    return team != null && Number(team.leader_id) === uid;
  }

  /**
   * Проверка: назначение команды — только участником этой команды;
   * при наличии команды исполнитель должен быть её участником (включая руководителя).
   */
  static async _validateTeamExecutorForTask(userId, teamId, executorId) {
    const actor = await User.findByPk(userId, {
      attributes: ['id', 'role', 'office_id'],
    });
    if (!actor) throw new NotFoundError('Пользователь не найден');

    if (teamId == null) {
      if (executorId != null) {
        await UserService.assertUsersAssignableByActor(actor, [executorId]);
      }
      return;
    }

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
    if (!team) throw new BadRequestError('Команда не найдена');

    const participantIds = new Set([
      team.leader_id,
      ...(team.members || []).map((m) => m.id),
    ]);
    const uid = Number(userId);
    const canAssignTeam =
      participantIds.has(uid) || Number(team.created_by) === uid;
    if (!canAssignTeam) {
      throw new ForbiddenError(
        'Назначить эту команду может только её участник или создатель'
      );
    }

    if (executorId != null && !participantIds.has(Number(executorId))) {
      throw new BadRequestError('Исполнитель должен быть участником выбранной команды');
    }
  }

  static async list(userId, query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const pageSize = Math.min(100, Math.max(1, toInt(query.pageSize ?? query.limit, 50)));
    const filter = typeof query.filter === 'string' ? query.filter : 'all'; // all|today|overdue
    const view = typeof query.view === 'string' ? query.view : null;
    const light =
      query.light === '1' || query.light === 'true' || query.light === true;

    const where = { [Op.and]: [this._accessWhere(userId)] };

    if (view) {
      where[Op.and].push(...buildViewWhereClauses(view, query));
    } else if (filter === 'today') {
      where[Op.and].push({
        scheduled_at: {
          [Op.gte]: new Date(`${yyyyMmDd(new Date())}T00:00:00.000Z`),
          [Op.lt]: new Date(`${yyyyMmDd(new Date(Date.now() + 86400000))}T00:00:00.000Z`),
        },
      });
    } else if (filter === 'overdue') {
      where[Op.and].push(
        { completed: false },
        {
          [Op.or]: [
            { deadline_to: { [Op.lt]: literal('CURRENT_DATE') } },
            literal("(deadline_to = CURRENT_DATE AND deadline_time IS NOT NULL AND deadline_time < to_char(NOW(), 'HH24:MI'))"),
          ],
        }
      );
    }

    const order = view ? orderForView(view) : [
      ['completed', 'ASC'],
      ['scheduled_at', 'ASC'],
      ['deadline_to', 'ASC'],
      ['updated_at', 'DESC'],
    ];

    const result = await UserTask.findAndCountAll({
      where,
      distinct: true,
      subQuery: false,
      order,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      include: this.taskDetailIncludes(light),
    });

    const total = result.count;
    const totalPages = Math.ceil(total / pageSize);
    return {
      tasks: result.rows,
      total,
      page,
      pageSize,
      totalPages,
      view: view ?? null,
    };
  }

  static async getById(userId, taskId) {
    const task = await UserTask.findByPk(taskId, {
      include: this.taskDetailIncludes(),
    });
    if (!task) throw new NotFoundError('Задача не найдена');
    if (!this._canAccess(task, userId)) throw new ForbiddenError('Нет доступа к задаче');
    return task;
  }

  static async create(userId, body = {}) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) throw new BadRequestError('Название задачи обязательно');
    const priority = normalizePriority(body.priority, 'medium');

    const { teamId, executorId } = this._normalizeAssignmentFromBody(body, {
      creatorId: userId,
      isCreate: true,
    });
    await this._validateTeamExecutorForTask(userId, teamId, null);

    if (executorId != null) {
      const actor = await User.findByPk(userId, {
        attributes: ['id', 'role', 'office_id'],
      });
      if (!actor) throw new NotFoundError('Пользователь не найден');
      await UserService.assertUsersAssignableByActor(actor, [executorId]);
    }

    let recurrence = {
      recurrence_type: 'none',
      recurrence_interval: 1,
      recurrence_custom_unit: null,
      recurrence_weekdays: null,
    };
    if (body.recurrence_type !== undefined) {
      recurrence = parseRecurrenceFromBody(body);
    }
    if (recurrence.recurrence_type !== 'none' && !body.scheduled_at) {
      throw new BadRequestError('Укажите дату и время для повторяющейся задачи');
    }

    const inboxFlag = typeof body.inbox === 'boolean' ? body.inbox : false;

    const createPayload = {
      creator_id: userId,
      title,
      completed: !!body.completed,
      completed_at: body.completed ? new Date() : null,
      scheduled_at: body.scheduled_at ?? null,
      inbox: inboxFlag,
      deadline_from: body.deadline_from ?? null,
      deadline_to: body.deadline_to ?? null,
      deadline_time: body.deadline_time ?? null,
      remind_at: body.remind_at ?? null,
      priority,
      reminders_disabled: typeof body.reminders_disabled === 'boolean' ? body.reminders_disabled : false,
      remind_before_minutes: typeof body.remind_before_minutes === 'number' ? body.remind_before_minutes : null,
      recurrence_type: recurrence.recurrence_type,
      recurrence_interval: recurrence.recurrence_interval,
      recurrence_custom_unit: recurrence.recurrence_custom_unit,
      recurrence_weekdays: recurrence.recurrence_weekdays,
      team_id: teamId,
      executor_id: executorId,
    };

    const task = await UserTask.create(createPayload);

    await this._syncAssigneeRows(task.id, executorId, userId);

    const fullTask = await this.getById(userId, task.id);
    await UserTaskAssignmentNotificationService.notifyOnCreate(fullTask, userId);

    return fullTask;
  }

  static async update(userId, taskId, body = {}) {
    const task = await UserTask.findByPk(taskId, {
      include: this.taskDetailIncludes(),
    });
    if (!task) throw new NotFoundError('Задача не найдена');
    if (!this._canAccess(task, userId)) throw new ForbiddenError('Нет доступа к задаче');

    const canEditDetails = await this._canEditTaskDetailsAsync(task, userId);
    if (!canEditDetails) {
      const allowedKeys = new Set(['completed']);
      const incomingKeys = Object.keys(body || {});
      const hasForbidden = incomingKeys.some((k) => !allowedKeys.has(k));
      if (hasForbidden) {
        throw new ForbiddenError('Только создатель или руководитель команды может изменять детали задачи');
      }
    }

    const previousTeamId = task.team_id;
    const previousExecutorId = task.executor_id;

    let normalized = null;
    if (canEditDetails) {
      normalized = this._normalizeAssignmentFromBody(body, {
        creatorId: task.creator_id,
        currentTeamId: task.team_id,
        currentExecutorId: task.executor_id,
        isCreate: false,
      });
      if (normalized.touched) {
        await this._validateTeamExecutorForTask(userId, normalized.teamId, null);
        if (normalized.executorId != null) {
          const actor = await User.findByPk(userId, {
            attributes: ['id', 'role', 'office_id'],
          });
          if (!actor) throw new NotFoundError('Пользователь не найден');
          await UserService.assertUsersAssignableByActor(actor, [normalized.executorId]);
        }
      }
    }

    if (canEditDetails && typeof body.title === 'string') task.title = body.title.trim();

    if (canEditDetails && body.recurrence_type !== undefined) {
      const r = parseRecurrenceFromBody(body);
      task.recurrence_type = r.recurrence_type;
      task.recurrence_interval = r.recurrence_interval;
      task.recurrence_custom_unit = r.recurrence_custom_unit;
      task.recurrence_weekdays = r.recurrence_weekdays;
    }

    if (canEditDetails && body.scheduled_at !== undefined) {
      task.scheduled_at = body.scheduled_at || null;
      if (!task.scheduled_at) {
        task.recurrence_type = 'none';
        task.recurrence_interval = 1;
        task.recurrence_custom_unit = null;
        task.recurrence_weekdays = null;
      }
    }

    if (canEditDetails && typeof body.inbox === 'boolean') {
      task.inbox = body.inbox;
    }

    if (canEditDetails && task.recurrence_type !== 'none' && !task.scheduled_at) {
      throw new BadRequestError('Укажите дату и время для повторяющейся задачи');
    }

    if (typeof body.completed === 'boolean') {
      if (body.completed === true) {
        const rule = {
          recurrence_type: task.recurrence_type,
          recurrence_interval: task.recurrence_interval,
          recurrence_custom_unit: task.recurrence_custom_unit,
          recurrence_weekdays: task.recurrence_weekdays,
        };
        if (rule.recurrence_type && rule.recurrence_type !== 'none' && task.scheduled_at) {
          const nextIso = computeNextScheduledAfterNow(task.scheduled_at, rule, new Date());
          if (nextIso) {
            task.scheduled_at = new Date(nextIso);
            task.completed = false;
            task.completed_at = null;
            task.completed_by = null;
          } else {
            task.completed = true;
            task.completed_at = new Date();
            task.completed_by = userId;
          }
        } else {
          task.completed = true;
          task.completed_at = new Date();
          task.completed_by = userId;
        }
      } else {
        task.completed = false;
        task.completed_at = null;
        task.completed_by = null;
      }
    }
    if (canEditDetails && body.deadline_from !== undefined) task.deadline_from = body.deadline_from || null;
    if (canEditDetails && body.deadline_to !== undefined) task.deadline_to = body.deadline_to || null;
    if (canEditDetails && body.deadline_time !== undefined) task.deadline_time = body.deadline_time || null;
    if (canEditDetails && body.remind_at !== undefined) task.remind_at = body.remind_at || null;
    if (canEditDetails && body.priority !== undefined) {
      task.priority = normalizePriority(body.priority, task.priority || 'medium');
    }
    if (canEditDetails && typeof body.reminders_disabled === 'boolean') {
      task.reminders_disabled = body.reminders_disabled;
    }
    if (canEditDetails && body.remind_before_minutes !== undefined) {
      task.remind_before_minutes =
        typeof body.remind_before_minutes === 'number' ? body.remind_before_minutes : null;
    }

    if (canEditDetails && normalized?.touched) {
      task.team_id = normalized.teamId;
      task.executor_id = normalized.executorId;
    }

    await task.save();

    if (canEditDetails && normalized?.touched) {
      if (normalized.clearAssignees) {
        await this._syncAssigneeRows(taskId, task.executor_id, task.creator_id);
      }
    }

    const fullTask = await this.getById(userId, taskId);

    if (canEditDetails && normalized?.touched) {
      await UserTaskAssignmentNotificationService.notifyOnAssignmentChange(fullTask, task.creator_id, {
        previousTeamId,
        previousExecutorId,
      });
    }

    return fullTask;
  }

  static async remove(userId, taskId) {
    const task = await UserTask.findByPk(taskId);
    if (!task) throw new NotFoundError('Задача не найдена');
    if (task.creator_id !== userId) throw new ForbiddenError('Нет доступа к задаче');
    await task.destroy();
    return true;
  }

  /**
   * Used by push actions: "in_1h" | "tomorrow" | "off"
   * Can be called by creator or assignee.
   */
  static async applyReminderAction(userId, taskId, action) {
    const task = await UserTask.findByPk(taskId, {
      include: this.taskDetailIncludes(),
    });
    if (!task) throw new NotFoundError('Задача не найдена');
    if (!this._canAccess(task, userId)) throw new ForbiddenError('Нет доступа к задаче');

    if (action !== 'in_1h' && action !== 'tomorrow' && action !== 'off') {
      throw new BadRequestError('Некорректное действие');
    }

    const now = new Date();
    if (action === 'off') {
      task.reminders_disabled = true;
      task.remind_at = null;
      task.remind_before_minutes = null;
    } else {
      task.reminders_disabled = false;
      if (action === 'in_1h') {
        task.remind_at = new Date(now.getTime() + 60 * 60 * 1000);
      } else if (action === 'tomorrow') {
        // Same time next calendar day (24h from now)
        task.remind_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    await task.save();
    return await this.getById(userId, taskId);
  }

  static async getTodayStats(userId) {
    const today = yyyyMmDd(new Date());
    const todayFrom = new Date(`${today}T00:00:00.000Z`);
    const todayTo = new Date(`${yyyyMmDd(new Date(Date.now() + 86400000))}T00:00:00.000Z`);
    const access = this._accessWhere(userId);

    const [todayTotal, todayCompleted, overdueCount] = await Promise.all([
      UserTask.count({
        distinct: true,
        col: 'id',
        include: [{ model: User, as: 'assignees', attributes: [], through: { attributes: [] }, required: false }],
        where: {
          [Op.and]: [
            access,
            {
              scheduled_at: {
                [Op.gte]: todayFrom,
                [Op.lt]: todayTo,
              },
            },
          ],
        },
      }),
      UserTask.count({
        distinct: true,
        col: 'id',
        include: [{ model: User, as: 'assignees', attributes: [], through: { attributes: [] }, required: false }],
        where: {
          [Op.and]: [
            access,
            { completed: true },
            {
              scheduled_at: {
                [Op.gte]: todayFrom,
                [Op.lt]: todayTo,
              },
            },
          ],
        },
      }),
      UserTask.count({
        distinct: true,
        col: 'id',
        include: [{ model: User, as: 'assignees', attributes: [], through: { attributes: [] }, required: false }],
        where: {
          [Op.and]: [
            access,
            { completed: false },
            {
              [Op.or]: [
                { deadline_to: { [Op.lt]: literal('CURRENT_DATE') } },
                literal("(deadline_to = CURRENT_DATE AND deadline_time IS NOT NULL AND deadline_time < to_char(NOW(), 'HH24:MI'))"),
              ],
            },
          ],
        },
      }),
    ]);

    return { todayCompleted, todayTotal, overdueCount };
  }

  static async getCalendar(userId, query = {}) {
    const startDate = typeof query.start_date === 'string' ? query.start_date : null;
    const endDate = typeof query.end_date === 'string' ? query.end_date : null;
    if (!startDate || !endDate) throw new BadRequestError('start_date и end_date обязательны');

    const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);

    const rows = await UserTask.findAll({
      distinct: true,
      subQuery: false,
      include: this.taskDetailIncludes(),
      where: {
        [Op.and]: [
          this._accessWhere(userId),
          {
            [Op.or]: [
              {
                scheduled_at: {
                  [Op.gte]: rangeStart,
                  [Op.lt]: rangeEnd,
                },
              },
              {
                [Op.and]: [
                  { inbox: true },
                  { scheduled_at: { [Op.is]: null } },
                  { deadline_to: { [Op.gte]: startDate, [Op.lte]: endDate } },
                ],
              },
            ],
          },
        ],
      },
    });

    const tasks = rows.map((row) => {
      const t = row.get({ plain: true });
      if (t.scheduled_at == null && t.inbox && t.deadline_to) {
        let hm = '12:00';
        if (typeof t.deadline_time === 'string' && /^\d{1,2}:\d{2}$/.test(t.deadline_time)) {
          const [hh, mm] = t.deadline_time.split(':');
          hm = `${String(hh).padStart(2, '0')}:${mm}`;
        }
        const d = typeof t.deadline_to === 'string' ? t.deadline_to.slice(0, 10) : t.deadline_to;
        t.scheduled_at = new Date(`${d}T${hm}:00.000Z`).toISOString();
      }
      return t;
    });
    tasks.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    return { tasks };
  }

  static async listAttachments(userId, taskId) {
    const task = await UserTask.findByPk(taskId, {
      include: [
        {
          model: User,
          as: 'assignees',
          attributes: ['id', 'full_name'],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Team,
          as: 'team',
          attributes: ['id', 'name', 'leader_id'],
          required: false,
          include: [
            {
              model: User,
              as: 'members',
              attributes: ['id'],
              through: { attributes: [] },
              required: false,
            },
          ],
        },
      ],
    });

    if (!task) throw new NotFoundError('Задача не найдена');
    if (!(await this._canAccessAsync(task, userId))) throw new ForbiddenError('Нет доступа к задаче');

    return await UserTaskAttachment.findAll({
      where: { user_task_id: taskId },
      order: [['created_at', 'DESC']],
    });
  }

  static async uploadAttachments(userId, taskId, files, req = null) {
    const task = await UserTask.findByPk(taskId, {
      include: [{ model: Team, as: 'team', attributes: ['id', 'leader_id'], required: false }],
    });
    if (!task) throw new NotFoundError('Задача не найдена');
    if (!(await this._canEditTaskDetailsAsync(task, userId))) {
      throw new ForbiddenError('Только создатель или руководитель команды может добавлять вложения');
    }

    if (!Array.isArray(files) || files.length === 0) throw new BadRequestError('Нет файлов для загрузки');
    if (files.length > 10) throw new BadRequestError('Слишком много файлов (макс. 10)');

    const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
    const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.3gp']);
    const DOCUMENT_EXTS = new Set([
      '.pdf',
      '.doc',
      '.docx',
      '.rtf',
      '.zip',
      '.rar',
      '.7z',
      '.tar',
      '.gz',
    ]);

    function guessKind(file) {
      const originalName = String(file?.originalname ?? '');
      const ext = path.extname(originalName).toLowerCase();
      const mime = String(file?.mimetype ?? '').toLowerCase();

      if (IMAGE_EXTS.has(ext) || mime.startsWith('image/')) return 'image';
      if (VIDEO_EXTS.has(ext) || mime.startsWith('video/')) return 'video';
      return 'document';
    }

    function isAllowedKind(file, kind) {
      const originalName = String(file?.originalname ?? '');
      const ext = path.extname(originalName).toLowerCase();
      const mime = String(file?.mimetype ?? '').toLowerCase();

      if (kind === 'image') return IMAGE_EXTS.has(ext) || mime.startsWith('image/');
      if (kind === 'video') return VIDEO_EXTS.has(ext) || mime.startsWith('video/');
      return DOCUMENT_EXTS.has(ext) || mime.startsWith('application/pdf') || mime.includes('wordprocessingml') || mime.includes('zip');
    }

    const attachments = [];
    for (const file of files) {
      const kind = guessKind(file);
      if (!isAllowedKind(file, kind)) throw new BadRequestError('Неподдерживаемый тип файла');

      const resource_type = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'raw';

      let result;
      try {
        result = await uploadToCloudinary(file.path, {
          folder: 'user_task_attachments',
          resource_type,
        });
      } catch (uploadErr) {
        const msg = (uploadErr?.message || '').toLowerCase();
        if (msg.includes('file size too large') || msg.includes('maximum is')) {
          throw new BadRequestError('Размер вложения превышает допустимый лимит. Попробуйте файл меньше 10 МБ.');
        }
        logger.error('uploadAttachments: failed to upload', { message: uploadErr?.message });
        throw uploadErr;
      } finally {
        await fs.unlink(file.path).catch(() => {});
      }

      attachments.push(
        await UserTaskAttachment.create({
          user_task_id: taskId,
          uploaded_by_id: userId,
          file_url: result.secure_url || result.url,
          file_name: file.originalname ?? null,
          mime_type: file.mimetype ?? null,
          file_kind: kind,
        })
      );
    }

    return attachments;
  }

  static async deleteAttachment(userId, taskId, attachmentId) {
    const task = await UserTask.findByPk(taskId, {
      include: [{ model: Team, as: 'team', attributes: ['id', 'leader_id'], required: false }],
    });
    if (!task) throw new NotFoundError('Задача не найдена');
    if (!(await this._canEditTaskDetailsAsync(task, userId))) {
      throw new ForbiddenError('Только создатель или руководитель команды может удалять вложения');
    }

    const attachment = await UserTaskAttachment.findByPk(attachmentId);
    if (!attachment || attachment.user_task_id !== taskId) throw new NotFoundError('Вложение не найдено');

    await deleteFromCloudinaryByUrl(attachment.file_url);
    await attachment.destroy();

    return true;
  }
}
