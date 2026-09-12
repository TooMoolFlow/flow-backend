import { OfficeLocationCatalog, Office } from '../models/init.model.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';

function trim255(v, field) {
  const s = v == null ? '' : String(v).trim();
  if (s.length > 255) {
    throw new BadRequestError(`Поле «${field}» не длиннее 255 символов.`);
  }
  return s;
}

class OfficeLocationCatalogService {
  static async listForOffice(officeId, { includeInactive = false } = {}) {
    const oid = Number(officeId);
    if (Number.isNaN(oid)) {
      throw new BadRequestError('Некорректный office_id');
    }
    const office = await Office.findByPk(oid);
    if (!office) {
      throw new NotFoundError('Офис не найден');
    }
    const where = { office_id: oid };
    if (!includeInactive) {
      where.is_active = true;
    }
    const rows = await OfficeLocationCatalog.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return rows.map((r) => r.get({ plain: true }));
  }

  static async createRow(managerOfficeId, payload) {
    const oid = Number(managerOfficeId);
    if (Number.isNaN(oid)) {
      throw new BadRequestError('Некорректный office_id');
    }
    const office = await Office.findByPk(oid);
    if (!office) {
      throw new NotFoundError('Офис не найден');
    }
    const block = trim255(payload.block, 'Блок');
    const floor_zone = trim255(payload.floor_zone, 'Этаж');
    const room = trim255(payload.room, 'Помещение');
    const sort_order = payload.sort_order != null ? Number(payload.sort_order) : 0;
    if (Number.isNaN(sort_order)) {
      throw new BadRequestError('Некорректный sort_order');
    }
    const row = await OfficeLocationCatalog.create({
      office_id: oid,
      block,
      floor_zone,
      room,
      sort_order,
      is_active: payload.is_active !== false,
    });
    return row.get({ plain: true });
  }

  static async updateRow(managerOfficeId, rowId, payload) {
    const oid = Number(managerOfficeId);
    const row = await OfficeLocationCatalog.findByPk(rowId);
    if (!row) {
      throw new NotFoundError('Запись не найдена');
    }
    if (Number(row.office_id) !== oid) {
      throw new ForbiddenError('Доступ запрещён.');
    }
    const updates = {};
    if (payload.block !== undefined) updates.block = trim255(payload.block, 'Блок');
    if (payload.floor_zone !== undefined) updates.floor_zone = trim255(payload.floor_zone, 'Этаж');
    if (payload.room !== undefined) updates.room = trim255(payload.room, 'Помещение');
    if (payload.sort_order !== undefined) {
      const n = Number(payload.sort_order);
      if (Number.isNaN(n)) throw new BadRequestError('Некорректный sort_order');
      updates.sort_order = n;
    }
    if (payload.is_active !== undefined) {
      updates.is_active = Boolean(payload.is_active);
    }
    await row.update(updates);
    const fresh = await OfficeLocationCatalog.findByPk(rowId);
    return fresh.get({ plain: true });
  }

  static async deleteRow(managerOfficeId, rowId) {
    const oid = Number(managerOfficeId);
    const row = await OfficeLocationCatalog.findByPk(rowId);
    if (!row) {
      throw new NotFoundError('Запись не найдена');
    }
    if (Number(row.office_id) !== oid) {
      throw new ForbiddenError('Доступ запрещён.');
    }
    await row.destroy();
  }
}

export default OfficeLocationCatalogService;
