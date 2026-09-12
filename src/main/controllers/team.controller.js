import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import TeamService from '../services/team.service.js';

/** Плоский JSON из Sequelize: иначе вложенные User иногда без полей вроде full_name. */
function teamToPlain(team) {
  if (!team) return team;
  return typeof team.get === 'function' ? team.get({ plain: true }) : team;
}

class TeamController {
  static list = asyncHandler(async (req, res) => {
    const result = await TeamService.list(req.user.id);
    res.json({
      teams: (result.teams || []).map((t) => teamToPlain(t)),
    });
  });

  static getById = asyncHandler(async (req, res) => {
    const teamId = parseInt(req.params.id, 10);
    const team = await TeamService.getById(req.user.id, teamId);
    res.json({ team: teamToPlain(team) });
  });

  static create = asyncHandler(async (req, res) => {
    const team = await TeamService.create(req.user.id, req.body);
    res.status(201).json({ team: teamToPlain(team) });
  });

  static update = asyncHandler(async (req, res) => {
    const teamId = parseInt(req.params.id, 10);
    const team = await TeamService.update(req.user.id, teamId, req.body);
    res.json({ team: teamToPlain(team) });
  });

  static remove = asyncHandler(async (req, res) => {
    const teamId = parseInt(req.params.id, 10);
    await TeamService.remove(req.user.id, teamId);
    res.status(204).send();
  });
}

export default TeamController;
