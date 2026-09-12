import { Op } from 'sequelize';

/** Допустимые значения scope для клиента (To Do / назначение). */
export const ASSIGN_USER_SEARCH_SCOPES = ['company', 'office'];

/**
 * @param {unknown} value
 * @returns {number|null|undefined} null — не передан; undefined — некорректный
 */
export function parseOptionalPositiveInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}

/**
 * @param {unknown} value
 * @returns {'company'|'office'|null|undefined}
 */
export function parseAssignUserSearchScope(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (!ASSIGN_USER_SEARCH_SCOPES.includes(s)) return undefined;
  return s;
}

/**
 * Условие Sequelize: пользователи компании + исполнители офиса (без привязки к компании).
 * @param {number} companyId
 */
export function buildCompanyAssignSearchCondition(companyId) {
  return {
    [Op.or]: [
      { company_id: companyId },
      { role: 'executor' },
    ],
  };
}

/**
 * Синхронная часть: office / company / scope по роли актора.
 *
 * @param {object|null} actor — JWT: { role, office_id }
 * @param {number|null|undefined} actorCompanyId — company_id из БД
 * @param {object} rawQuery — { scope?, office_id?, company_id? }
 * @param {string|null} roleFilter
 * @returns {{ officeId: number|null, companyId: number|null, effectiveScope: 'company'|'office'|null, roleFilter: string|null } | { error: { type: 'bad_request'|'forbidden', message: string } }}
 */
export function resolveAssignUserSearchFilters(
  actor,
  actorCompanyId,
  rawQuery = {},
  roleFilter = null,
) {
  const role = actor?.role;
  const actorOfficeId =
    actor?.office_id != null && Number.isFinite(Number(actor.office_id))
      ? Number(actor.office_id)
      : null;

  const parsedScope = parseAssignUserSearchScope(rawQuery.scope);
  const parsedOfficeId = parseOptionalPositiveInt(rawQuery.office_id);
  const parsedCompanyId = parseOptionalPositiveInt(rawQuery.company_id);

  if (rawQuery.scope != null && rawQuery.scope !== '' && parsedScope === undefined) {
    return {
      error: {
        type: 'bad_request',
        message: 'Некорректный scope. Допустимо: company, office',
      },
    };
  }
  if (
    rawQuery.office_id != null &&
    rawQuery.office_id !== '' &&
    parsedOfficeId === undefined
  ) {
    return { error: { type: 'bad_request', message: 'Некорректный office_id' } };
  }
  if (
    rawQuery.company_id != null &&
    rawQuery.company_id !== '' &&
    parsedCompanyId === undefined
  ) {
    return { error: { type: 'bad_request', message: 'Некорректный company_id' } };
  }

  if (role === 'admin-worker') {
    return {
      officeId: parsedOfficeId,
      companyId: parsedCompanyId,
      effectiveScope: parsedCompanyId != null ? 'company' : parsedScope,
      roleFilter,
    };
  }

  if (role === 'department-head') {
    if (
      parsedOfficeId != null &&
      actorOfficeId != null &&
      parsedOfficeId !== actorOfficeId
    ) {
      return {
        error: {
          type: 'forbidden',
          message: 'Доступ только к пользователям своего офиса',
        },
      };
    }
    return {
      officeId: actorOfficeId,
      companyId: parsedCompanyId,
      effectiveScope: parsedCompanyId != null ? 'company' : null,
      roleFilter,
    };
  }

  if (
    parsedOfficeId != null &&
    actorOfficeId != null &&
    parsedOfficeId !== actorOfficeId
  ) {
    return {
      error: {
        type: 'forbidden',
        message: 'Доступ только к пользователям своего офиса',
      },
    };
  }

  if (parsedCompanyId != null) {
    return {
      error: {
        type: 'forbidden',
        message: 'Недостаточно прав для фильтра по компании',
      },
    };
  }

  const hasCompany =
    actorCompanyId != null &&
    Number.isFinite(Number(actorCompanyId)) &&
    Number(actorCompanyId) > 0;
  const defaultScope = hasCompany ? 'company' : 'office';
  const effectiveScope = parsedScope ?? defaultScope;

  if (effectiveScope === 'company' && hasCompany) {
    return {
      officeId: actorOfficeId,
      companyId: Number(actorCompanyId),
      effectiveScope: 'company',
      roleFilter,
    };
  }

  return {
    officeId: actorOfficeId,
    companyId: null,
    effectiveScope: 'office',
    roleFilter,
  };
}
