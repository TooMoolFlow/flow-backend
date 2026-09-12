import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CreateRequestDto,
  UpdateRequestDto,
  UpdateUserProfileDto,
  UpdateUserRoleDto,
} from './user.dto.js';
import { validateBody } from '../middleware/validate.middleware.js';

/** Как в реальном PUT /users/:id — сначала применяется правильная Zod-схема. */

function createResponseMock() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
    locals: {},
  };
}

test('UpdateUserProfileDto: успех — только full_name', () => {
  const r = UpdateUserProfileDto.safeParse({
    full_name: 'Иван Иванов',
  });
  assert.equal(r.success, true);
  assert.equal(r.success ? r.data.full_name : null, 'Иван Иванов');
});

test('UpdateUserProfileDto: успех — только phone', () => {
  const r = UpdateUserProfileDto.safeParse({
    phone: '+7 900 111 22 33',
  });
  assert.equal(r.success, true);
});

test('UpdateUserProfileDto: успех — только office_id (клиент и др.)', () => {
  const r = UpdateUserProfileDto.safeParse({
    office_id: 42,
  });
  assert.equal(r.success, true);
});

test('UpdateUserProfileDto: успех — office_id и category_ids (перевод исполнителя)', () => {
  const r = UpdateUserProfileDto.safeParse({
    office_id: 2,
    category_ids: [10, 11],
  });
  assert.equal(r.success, true);
  assert.deepEqual(r.success ? r.data.category_ids : null, [10, 11]);
});

test('UpdateUserProfileDto: успех — полный набор допустимых полей профиля', () => {
  const r = UpdateUserProfileDto.safeParse({
    full_name: 'Пётр Петрович',
    phone: '+7 999 888 77 66',
    office_id: 3,
    category_ids: [5],
  });
  assert.equal(r.success, true);
});

test('UpdateUserProfileDto: отказ — пустое тело профиля (ни одного из обязательных ключей)', () => {
  const r = UpdateUserProfileDto.safeParse({});
  assert.equal(r.success, false);
});

test('UpdateUserProfileDto: отказ — только category_ids без office_id', () => {
  const r = UpdateUserProfileDto.safeParse({
    category_ids: [1, 2],
  });
  assert.equal(r.success, false);
});

test('UpdateUserProfileDto: отказ — full_name короче 2 символов', () => {
  const r = UpdateUserProfileDto.safeParse({
    full_name: 'Я',
  });
  assert.equal(r.success, false);
});

test('UpdateUserProfileDto: отказ — office_id не целое / неположительное', () => {
  assert.equal(UpdateUserProfileDto.safeParse({ office_id: 0 }).success, false);
  assert.equal(UpdateUserProfileDto.safeParse({ office_id: -1 }).success, false);
  assert.equal(UpdateUserProfileDto.safeParse({ office_id: 1.5 }).success, false);
});

test('UpdateUserProfileDto: отказ — category_ids содержит неположительный id', () => {
  const r = UpdateUserProfileDto.safeParse({
    office_id: 1,
    category_ids: [0, 1],
  });
  assert.equal(r.success, false);
});

test('UpdateUserProfileDto: отказ — category_ids как пустой массив (min 1 при наличии поля)', () => {
  const r = UpdateUserProfileDto.safeParse({
    office_id: 1,
    category_ids: [],
  });
  assert.equal(r.success, false);
});

test('validateBody(UpdateUserProfileDto): пропускает валидное тело офис+category_ids', () => {
  const middleware = validateBody(UpdateUserProfileDto);
  const req = {
    body: {
      office_id: 99,
      category_ids: [1, 2],
    },
    method: 'PUT',
    originalUrl: '/api/users/7',
  };
  const res = createResponseMock();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
  assert.deepEqual(req.body, {
    office_id: 99,
    category_ids: [1, 2],
  });
});

test('validateBody(UpdateUserProfileDto): 400 только category_ids без office_id (refine)', () => {
  const middleware = validateBody(UpdateUserProfileDto);
  const req = {
    body: { category_ids: [1] },
    method: 'PUT',
    originalUrl: '/api/users/7',
  };
  const res = createResponseMock();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Validation error');
  assert.ok(Array.isArray(res.payload.details));
});

// ——— PUT /users/:id с телом про роль (другая схема на маршруте) ———

test('UpdateUserRoleDto: успешно — только роль', () => {
  const r = UpdateUserRoleDto.safeParse({
    role: 'client',
  });
  assert.equal(r.success, true);
});

test('UpdateUserRoleDto: успешно — роль исполнитель с category_ids и specialty', () => {
  const r = UpdateUserRoleDto.safeParse({
    role: 'executor',
    category_ids: [10, 20],
    specialty: 'Электрик',
  });
  assert.equal(r.success, true);
});

test('UpdateUserRoleDto: отказ — неверная строка роли', () => {
  const r = UpdateUserRoleDto.safeParse({
    role: 'root',
  });
  assert.equal(r.success, false);
});

// ——— CreateRequestDto: компания и «Другое» только для роли client ———

test('CreateRequestDto: успех — клиент с company_id', () => {
  const r = CreateRequestDto.safeParse({
    phone: '+7 700 111 22 33',
    full_name: 'Иван Иванов',
    office_id: 1,
    role: 'client',
    company_id: 5,
    password: 'secret123',
  });
  assert.equal(r.success, true);
});

test('CreateRequestDto: успех — клиент с company_other_name', () => {
  const r = CreateRequestDto.safeParse({
    phone: '+7 700 111 22 33',
    full_name: 'Иван Иванов',
    office_id: 1,
    role: 'client',
    company_other_name: 'ООО Ромашка',
    password: 'secret123',
  });
  assert.equal(r.success, true);
});

test('CreateRequestDto: отказ — одновременно company_id и company_other_name', () => {
  const r = CreateRequestDto.safeParse({
    phone: '+7 700 111 22 33',
    full_name: 'Иван Иванов',
    office_id: 1,
    role: 'client',
    company_id: 5,
    company_other_name: 'ООО Ромашка',
    password: 'secret123',
  });
  assert.equal(r.success, false);
});

test('CreateRequestDto: отказ — компания у исполнителя', () => {
  const r = CreateRequestDto.safeParse({
    phone: '+7 700 111 22 33',
    full_name: 'Иван Иванов',
    office_id: 1,
    role: 'executor',
    company_id: 5,
    password: 'secret123',
  });
  assert.equal(r.success, false);
});

test('UpdateRequestDto: успех — снять компанию через null', () => {
  const r = UpdateRequestDto.safeParse({
    company_id: null,
  });
  assert.equal(r.success, true);
});

test('UpdateRequestDto: отказ — одновременно company_id и company_other_name', () => {
  const r = UpdateRequestDto.safeParse({
    company_id: 1,
    company_other_name: 'X',
  });
  assert.equal(r.success, false);
});

// ——— UpdateUserProfileDto: company_id ———

test('UpdateUserProfileDto: успех — только company_id', () => {
  const r = UpdateUserProfileDto.safeParse({
    company_id: 7,
  });
  assert.equal(r.success, true);
});

test('UpdateUserProfileDto: успех — снять компанию через company_id null', () => {
  const r = UpdateUserProfileDto.safeParse({
    company_id: null,
  });
  assert.equal(r.success, true);
});

test('UpdateUserProfileDto: отказ — company_id отрицательный', () => {
  const r = UpdateUserProfileDto.safeParse({
    company_id: -1,
  });
  assert.equal(r.success, false);
});
