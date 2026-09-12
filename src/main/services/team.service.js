import { Op } from 'sequelize';

import { sequelize } from '../config/database.config.js';
import { Team } from '../models/team.model.js';
import { TeamMember } from '../models/teamMember.model.js';
import { UserTask } from '../models/userTask.model.js';
import { UserTaskAssignee } from '../models/userTaskAssignee.model.js';
import { User } from '../models/user.model.js';
import UserService from './user.service.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors/errors.js';

function toInt(value, fallback) {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseMemberIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => toInt(x, NaN)).filter(Number.isFinite);
  if (typeof raw === 'string') {
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

function teamFieldInt(team, field) {
  const raw = typeof team?.get === 'function' ? team.get(field) : team?.[field];
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export default class TeamService {
  static _canAccessTeam(team, userId) {
    const uid = Number(userId);
    if (!team || !Number.isFinite(uid)) return false;
    if (teamFieldInt(team, 'created_by') === uid) return true;
    if (teamFieldInt(team, 'leader_id') === uid) return true;
    const members = team.members || [];
    return members.some((m) => Number(m.id) === uid);
  }

  static _isTeamCreator(team, userId) {
    return teamFieldInt(team, 'created_by') === Number(userId);
  }

  static _isTeamLeader(team, userId) {
    return teamFieldInt(team, 'leader_id') === Number(userId);
  }

  static _canManageTeamMembers(team, userId) {
    return this._isTeamCreator(team, userId) || this._isTeamLeader(team, userId);
  }

  /** Сохранить доступ к уже существующим командным задачам после исключения из команды. */
  static async _retainTeamTasksForRemovedMembers(teamId, removedUserIds, transaction) {
    const ids = uniqueInts(removedUserIds);
    if (!ids.length) return;

    const tasks = await UserTask.findAll({
      where: { team_id: teamId },
      attributes: ['id'],
      transaction,
    });
    if (!tasks.length) return;

    const rows = [];
    for (const task of tasks) {
      for (const userId of ids) {
        rows.push({ user_task_id: task.id, user_id: userId });
      }
    }
    await UserTaskAssignee.bulkCreate(rows, { transaction, ignoreDuplicates: true });
  }

  static async list(userId) {
    const uid = Number(userId);
    const teams = await Team.findAll({
      distinct: true,
      subQuery: false,
      include: [
        { model: User, as: 'leader', attributes: ['id', 'full_name'] },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'full_name'],
          through: { attributes: [] },
          required: false,
        },
      ],
      where: {
        [Op.or]: [{ created_by: uid }, { leader_id: uid }, { '$members.id$': uid }],
      },
      order: [['updated_at', 'DESC']],
    });
    return { teams };
  }

  static async getById(userId, teamId) {
    const team = await Team.findByPk(teamId, {
      include: [
        { model: User, as: 'leader', attributes: ['id', 'full_name'] },
        { model: User, as: 'teamCreator', attributes: ['id', 'full_name'] },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'full_name'],
          through: { attributes: [] },
        },
      ],
    });
    if (!team) throw new NotFoundError('Команда не найдена');
    if (!this._canAccessTeam(team, userId)) throw new ForbiddenError('Нет доступа к команде');
    return team;
  }

  static async create(userId, body = {}) {
    const actor = await User.findByPk(userId, {
      attributes: ['id', 'role', 'office_id'],
    });
    if (!actor) throw new NotFoundError('Пользователь не найден');

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new BadRequestError('Название команды обязательно');

    const leaderId = toInt(body.leader_id, NaN);
    if (!Number.isFinite(leaderId)) throw new BadRequestError('Укажите руководителя команды');

    let memberIds = uniqueInts(parseMemberIds(body.member_ids));
    if (!memberIds.includes(leaderId)) memberIds.push(leaderId);

    await UserService.assertUsersAssignableByActor(actor, memberIds);

    const transaction = await sequelize.transaction();
    let createdId;
    try {
      const team = await Team.create(
        {
          name,
          leader_id: leaderId,
          created_by: Number(userId),
        },
        { transaction }
      );
      createdId = team.id;
      await TeamMember.bulkCreate(
        memberIds.map((uid) => ({ team_id: team.id, user_id: uid })),
        { transaction, ignoreDuplicates: true }
      );
      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    return await this.getById(userId, createdId);
  }

  static async update(userId, teamId, body = {}) {
    const actor = await User.findByPk(userId, {
      attributes: ['id', 'role', 'office_id'],
    });
    if (!actor) throw new NotFoundError('Пользователь не найден');

    const team = await Team.findByPk(teamId, {
      include: [
        {
          model: User,
          as: 'members',
          attributes: ['id', 'full_name'],
          through: { attributes: [] },
        },
      ],
    });
    if (!team) throw new NotFoundError('Команда не найдена');
    if (!this._canManageTeamMembers(team, userId)) {
      throw new ForbiddenError('Только создатель или руководитель может редактировать команду');
    }

    const isCreator = this._isTeamCreator(team, userId);
    const isLeaderOnly = !isCreator && this._isTeamLeader(team, userId);

    if (isLeaderOnly && (body.name !== undefined || body.leader_id !== undefined)) {
      throw new ForbiddenError('Только создатель команды может менять название и руководителя');
    }

    if (typeof body.name === 'string') {
      const trimmed = body.name.trim();
      if (!trimmed) throw new BadRequestError('Название команды не может быть пустым');
      team.name = trimmed;
    }

    if (body.leader_id !== undefined) {
      const nextLeader = toInt(body.leader_id, NaN);
      if (!Number.isFinite(nextLeader)) throw new BadRequestError('Некорректный руководитель');
      team.leader_id = nextLeader;
    }

    const transaction = await sequelize.transaction();
    try {
      await team.save({ transaction });

      if (body.member_ids !== undefined) {
        const previousMemberIds = (team.members || [])
          .map((m) => Number(m.id))
          .filter((id) => Number.isFinite(id));

        let memberIds = uniqueInts(parseMemberIds(body.member_ids));
        const leaderId = teamFieldInt(team, 'leader_id');
        if (Number.isFinite(leaderId) && !memberIds.includes(leaderId)) memberIds.push(leaderId);

        await UserService.assertUsersAssignableByActor(actor, memberIds);

        const nextMemberSet = new Set(memberIds);
        const removedIds = previousMemberIds.filter((id) => !nextMemberSet.has(id));
        if (removedIds.length > 0) {
          await this._retainTeamTasksForRemovedMembers(teamId, removedIds, transaction);
        }

        await TeamMember.destroy({ where: { team_id: teamId }, transaction });
        await TeamMember.bulkCreate(
          memberIds.map((uid) => ({ team_id: teamId, user_id: uid })),
          { transaction, ignoreDuplicates: true }
        );
      } else if (body.leader_id !== undefined) {
        await UserService.assertUsersAssignableByActor(actor, [team.leader_id]);
        await TeamMember.findOrCreate({
          where: { team_id: teamId, user_id: team.leader_id },
          defaults: { team_id: teamId, user_id: team.leader_id },
          transaction,
        });
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    return await this.getById(userId, teamId);
  }

  static async remove(userId, teamId) {
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
    if (!team) throw new NotFoundError('Команда не найдена');
    if (!this._isTeamCreator(team, userId)) {
      throw new ForbiddenError('Удалить команду может только создатель');
    }

    await team.destroy();
    return true;
  }
}
