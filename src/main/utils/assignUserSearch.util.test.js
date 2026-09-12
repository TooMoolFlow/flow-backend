import test from 'node:test';
import assert from 'node:assert/strict';
import { Op } from 'sequelize';

import {
  ASSIGN_USER_SEARCH_SCOPES,
  buildCompanyAssignSearchCondition,
  parseAssignUserSearchScope,
  parseOptionalPositiveInt,
  resolveAssignUserSearchFilters,
} from './assignUserSearch.util.js';

test('parseOptionalPositiveInt: null для пустого, число для валидного, undefined для мусора', () => {
  assert.equal(parseOptionalPositiveInt(null), null);
  assert.equal(parseOptionalPositiveInt(''), null);
  assert.equal(parseOptionalPositiveInt(undefined), null);
  assert.equal(parseOptionalPositiveInt('5'), 5);
  assert.equal(parseOptionalPositiveInt(12), 12);
  assert.equal(parseOptionalPositiveInt('0'), undefined);
  assert.equal(parseOptionalPositiveInt('-1'), undefined);
  assert.equal(parseOptionalPositiveInt('abc'), undefined);
});

test('parseAssignUserSearchScope: company и office', () => {
  assert.equal(parseAssignUserSearchScope(null), null);
  assert.equal(parseAssignUserSearchScope('company'), 'company');
  assert.equal(parseAssignUserSearchScope('OFFICE'), 'office');
  assert.equal(parseAssignUserSearchScope('all'), undefined);
});

test('ASSIGN_USER_SEARCH_SCOPES содержит company и office', () => {
  assert.deepEqual(ASSIGN_USER_SEARCH_SCOPES, ['company', 'office']);
});

test('buildCompanyAssignSearchCondition: клиенты компании + исполнители', () => {
  const cond = buildCompanyAssignSearchCondition(7);
  assert.ok(cond[Op.or]);
  assert.deepEqual(cond[Op.or], [
    { company_id: 7 },
    { role: 'executor' },
  ]);
});

test('client с company_id: по умолчанию scope=company', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 2 },
    10,
    {},
    null,
  );
  assert.equal('error' in r, false);
  assert.equal(r.officeId, 2);
  assert.equal(r.companyId, 10);
  assert.equal(r.effectiveScope, 'company');
});

test('client без company_id: по умолчанию scope=office', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 2 },
    null,
    {},
    null,
  );
  assert.equal(r.officeId, 2);
  assert.equal(r.companyId, null);
  assert.equal(r.effectiveScope, 'office');
});

test('client: scope=office переключает на весь офис', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 2 },
    10,
    { scope: 'office' },
    null,
  );
  assert.equal(r.companyId, null);
  assert.equal(r.effectiveScope, 'office');
});

test('client: scope=company без company_id актора → office', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 2 },
    null,
    { scope: 'company' },
    null,
  );
  assert.equal(r.companyId, null);
  assert.equal(r.effectiveScope, 'office');
});

test('client: чужой office_id → forbidden', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 2 },
    10,
    { office_id: '99' },
    null,
  );
  assert.equal(r.error?.type, 'forbidden');
});

test('client: company_id в query → forbidden', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 2 },
    10,
    { company_id: '5' },
    null,
  );
  assert.equal(r.error?.type, 'forbidden');
});

test('department-head: всегда свой офис, опц. company_id', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'department-head', office_id: 3 },
    null,
    { company_id: '8' },
    null,
  );
  assert.equal(r.officeId, 3);
  assert.equal(r.companyId, 8);
  assert.equal(r.effectiveScope, 'company');
});

test('department-head: чужой office_id → forbidden', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'department-head', office_id: 3 },
    null,
    { office_id: '1' },
    null,
  );
  assert.equal(r.error?.type, 'forbidden');
});

test('admin-worker: office_id и company_id из query', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'admin-worker', office_id: 1 },
    null,
    { office_id: '5', company_id: '12' },
    'client',
  );
  assert.equal(r.officeId, 5);
  assert.equal(r.companyId, 12);
  assert.equal(r.roleFilter, 'client');
  assert.equal(r.effectiveScope, 'company');
});

test('admin-worker: без фильтров — весь доступ', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'admin-worker' },
    null,
    {},
    null,
  );
  assert.equal(r.officeId, null);
  assert.equal(r.companyId, null);
});

test('некорректный scope → bad_request', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'client', office_id: 1 },
    5,
    { scope: 'global' },
    null,
  );
  assert.equal(r.error?.type, 'bad_request');
});

test('executor: без company — весь офис', () => {
  const r = resolveAssignUserSearchFilters(
    { role: 'executor', office_id: 4 },
    null,
    {},
    null,
  );
  assert.equal(r.officeId, 4);
  assert.equal(r.companyId, null);
  assert.equal(r.effectiveScope, 'office');
});
