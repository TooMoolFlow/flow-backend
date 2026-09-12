import { Op } from 'sequelize';

import { Company, Office, User } from '../models/init.model.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/errors.js';
import { sequelize } from '../config/database.config.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';

const NAME_MAX = 255;

function normalizeOfficeId(officeId, label = 'office_id') {
  const oid = Number(officeId);
  if (!Number.isFinite(oid) || oid < 1) {
    throw new BadRequestError(`Некорректный ${label}`);
  }
  return oid;
}

function normalizeName(raw) {
  const name = raw == null ? '' : String(raw).trim();
  if (!name) {
    throw new BadRequestError('Название компании обязательно');
  }
  if (name.length > NAME_MAX) {
    throw new BadRequestError(`Название компании не длиннее ${NAME_MAX} символов`);
  }
  return name;
}

async function ensureOfficeExists(officeId, transaction = null) {
  const office = await Office.findByPk(officeId, { transaction });
  if (!office) {
    throw new NotFoundError('Офис не найден');
  }
  return office;
}

class CompanyService {
  /**
   * Получить список компаний офиса.
   * Эндпоинт публичный (используется на регистрации), поэтому actor может быть null.
   * department-head ограничен своим офисом (контроль на уровне маршрута для мутаций).
   */
  static async listForOffice(officeId) {
    const oid = normalizeOfficeId(officeId);
    await ensureOfficeExists(oid);
    const rows = await Company.findAll({
      where: { office_id: oid },
      order: [
        [sequelize.fn('LOWER', sequelize.col('name')), 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return rows.map((r) => r.get({ plain: true }));
  }

  /** Получить компанию по id с проверкой принадлежности офису. */
  static async getCompanyForOffice(officeId, companyId, { transaction = null } = {}) {
    const oid = normalizeOfficeId(officeId);
    const cid = Number(companyId);
    if (!Number.isFinite(cid) || cid < 1) {
      throw new BadRequestError('Некорректный company_id');
    }
    const company = await Company.findByPk(cid, { transaction });
    if (!company || Number(company.office_id) !== oid) {
      throw new NotFoundError('Компания не найдена в этом офисе');
    }
    return company;
  }

  static async createCompany(officeId, payload) {
    const oid = normalizeOfficeId(officeId);
    const name = normalizeName(payload?.name);

    await ensureOfficeExists(oid);

    const exists = await Company.findOne({
      where: {
        office_id: oid,
        name: { [Op.iLike]: name },
      },
    });
    if (exists) {
      throw new ConflictError('Компания с таким названием уже существует в этом офисе');
    }

    const company = await Company.create({ office_id: oid, name });
    return company.get({ plain: true });
  }

  static async updateCompany(officeId, companyId, payload) {
    const oid = normalizeOfficeId(officeId);
    const company = await CompanyService.getCompanyForOffice(oid, companyId);

    const updates = {};
    if (payload?.name !== undefined) {
      const name = normalizeName(payload.name);
      const conflict = await Company.findOne({
        where: {
          office_id: oid,
          id: { [Op.ne]: company.id },
          name: { [Op.iLike]: name },
        },
      });
      if (conflict) {
        throw new ConflictError('Компания с таким названием уже существует в этом офисе');
      }
      updates.name = name;
    }

    if (Object.keys(updates).length === 0) {
      return company.get({ plain: true });
    }

    await company.update(updates);
    return company.get({ plain: true });
  }

  /**
   * Удаление компании. У всех клиентов, привязанных к ней, company_id обнулится через ON DELETE SET NULL.
   * Офис пользователя сохраняется.
   */
  static async deleteCompany(officeId, companyId) {
    const oid = normalizeOfficeId(officeId);
    const company = await CompanyService.getCompanyForOffice(oid, companyId);

    const tx = await sequelize.transaction();
    try {
      // Явно сбрасываем company_id на случай отсутствия каскадного триггера в существующей БД.
      await User.update(
        { company_id: null },
        { where: { company_id: company.id }, transaction: tx },
      );
      await company.destroy({ transaction: tx });
      await tx.commit();
    } catch (err) {
      await rollbackAndRethrow(tx, err);
    }
  }

  /**
   * Проверить, что actor может управлять компаниями офиса.
   * - admin-worker — любой офис;
   * - department-head — только свой;
   * - другие роли — запрещено.
   */
  static assertOfficeMutationAccess(actor, officeId) {
    const role = actor?.role;
    if (role === 'admin-worker') return;
    if (role === 'department-head') {
      const userOfficeId = actor.office_id != null ? Number(actor.office_id) : null;
      if (userOfficeId == null || Number.isNaN(userOfficeId) || Number(officeId) !== userOfficeId) {
        throw new ForbiddenError('Доступ разрешён только к своему офису');
      }
      return;
    }
    throw new ForbiddenError('Недостаточно прав для управления компаниями');
  }
}

export default CompanyService;
