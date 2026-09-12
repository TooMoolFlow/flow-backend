import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import { ServiceCategory, ServiceSubcategory } from '../models/init.model.js';

function parseOfficeId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('Некорректный office_id');
  }
  return id;
}

/**
 * Офис для чтения списка категорий (создание заявки, справочники).
 * office_id в query — фильтр по выбранному офису; без query — все офисы (null).
 * Не привязывается к user.office_id: пользователь может выбрать любой офис в форме.
 */
export function resolveListOfficeId(_user, queryOfficeId) {
  if (queryOfficeId != null && queryOfficeId !== '') {
    return parseOfficeId(queryOfficeId);
  }
  return null;
}

/** Публичный список (регистрация): office_id обязателен. */
export function resolvePublicOfficeId(queryOfficeId) {
  if (queryOfficeId == null || queryOfficeId === '') {
    throw new BadRequestError('Укажите office_id');
  }
  return parseOfficeId(queryOfficeId);
}

/**
 * Офис для создания/изменения/удаления категорий и подкатегорий.
 * department-head — только свой офис.
 * admin-worker — office_id в query (обязателен).
 */
export function resolveManageOfficeId(user, queryOfficeId) {
  if (user.role === 'department-head') {
    if (!user.office_id) {
      throw new BadRequestError('У офис-менеджера не указан офис');
    }
    return Number(user.office_id);
  }

  if (user.role === 'admin-worker') {
    if (queryOfficeId == null || queryOfficeId === '') {
      throw new BadRequestError('Укажите office_id');
    }
    return parseOfficeId(queryOfficeId);
  }

  throw new ForbiddenError('Forbidden');
}

export async function getCategoryInOffice(categoryId, officeId, transaction = null) {
  const category = await ServiceCategory.findByPk(categoryId, { transaction });
  if (!category) {
    throw new NotFoundError('Service category not found');
  }
  if (Number(category.office_id) !== Number(officeId)) {
    throw new ForbiddenError('Forbidden');
  }
  return category;
}

export async function getSubcategoryInOffice(subcategoryId, officeId, transaction = null) {
  const subcategory = await ServiceSubcategory.findByPk(subcategoryId, { transaction });
  if (!subcategory) {
    throw new NotFoundError('Service subcategory not found');
  }
  if (Number(subcategory.office_id) !== Number(officeId)) {
    throw new ForbiddenError('Forbidden');
  }
  return subcategory;
}

/** Проверка доступа к категории при назначении исполнителей (чтение списка по категории). */
export function assertCanAccessCategoryOffice(user) {
  // manager добавлен для чтения списка исполнителей категории — его дашборд
  // запрашивает этот список и получал 403. На изменение категорий это не влияет:
  // мутирующие роуты по-прежнему закрыты guard-ом categoryManagers.
  if (user.role === 'admin-worker' || user.role === 'department-head' || user.role === 'manager') {
    return;
  }
  throw new ForbiddenError('Forbidden');
}
