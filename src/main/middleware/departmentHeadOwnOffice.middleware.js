import { ForbiddenError, NotFoundError } from '../errors/errors.js';
import { RequestGroup } from '../models/init.model.js';

/**
 * Создавать и менять шаблоны локаций могут:
 * — admin-worker: для любого офиса (office_id задаётся в пути маршрута);
 * — department-head (офис-менеджер): только для своего офиса, :id совпадает с office_id.
 */
export const requireLocationCatalogMutationAccess = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin-worker') {
    return next();
  }
  if (role === 'department-head') {
    const routeOfficeId = Number(req.params.id);
    const userOfficeId = req.user.office_id != null ? Number(req.user.office_id) : null;
    if (userOfficeId == null || Number.isNaN(userOfficeId) || Number.isNaN(routeOfficeId) || routeOfficeId !== userOfficeId) {
      return next(new ForbiddenError('Доступ запрещён.'));
    }
    return next();
  }
  return next(new ForbiddenError('Доступ запрещён.'));
};

/**
 * Принимать и отклонять заявки могут:
 * — admin-worker: в любом офисе;
 * — department-head (офис-менеджер): только заявки своего офиса.
 *
 * Офис берётся из самой группы заявок, а не из пути, поэтому проверка
 * асинхронная. Без неё офис-менеджер вообще не мог принять заявку
 * (роут был открыт только admin-worker и отдавал 403).
 */
export const requireRequestGroupOfficeAccess = async (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin-worker') {
    return next();
  }
  if (role !== 'department-head') {
    return next(new ForbiddenError('Доступ запрещён.'));
  }

  try {
    const group = await RequestGroup.findByPk(req.params.id, {
      attributes: ['id', 'office_id'],
    });
    if (!group) {
      return next(new NotFoundError('Заявка не найдена'));
    }

    const userOfficeId = req.user.office_id != null ? Number(req.user.office_id) : null;
    if (userOfficeId == null || Number(group.office_id) !== userOfficeId) {
      return next(new ForbiddenError('Заявка относится к другому офису.'));
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
