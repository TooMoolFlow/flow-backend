import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import { validateBody, validateRequest } from './validate.middleware.js';

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
  };
}

test('validateRequest parses configured request parts before controller', () => {
  const middleware = validateRequest({
    query: z.object({
      period: z.enum(['day', 'week']).default('day'),
    }).strict(),
    body: z.object({
      enabled: z.boolean(),
    }).strict(),
  });

  const req = {
    query: {},
    body: { enabled: true },
    method: 'POST',
    originalUrl: '/api/healthy/insights',
  };
  const res = createResponseMock();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.validated?.query, { period: 'day' });
  assert.deepEqual(req.body, { enabled: true });
  assert.equal(res.statusCode, null);
});

test('validateRequest stores parsed query when req.query is readonly', () => {
  const middleware = validateRequest({
    query: z.object({
      period: z.enum(['day', 'week']).default('day'),
    }).strict(),
  });

  const req = {
    method: 'GET',
    originalUrl: '/api/healthy/insights',
  };
  Object.defineProperty(req, 'query', {
    get() {
      return {};
    },
    configurable: true,
  });

  const res = {
    ...createResponseMock(),
    locals: {},
  };
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.validated?.query, { period: 'day' });
  assert.deepEqual(res.locals.validated?.query, { period: 'day' });
  assert.equal(res.statusCode, null);
});

test('validateRequest returns 400 with details on invalid input', () => {
  const middleware = validateRequest({
    body: z.object({
      enabled: z.boolean(),
    }).strict(),
  });

  const req = {
    body: { enabled: 'yes' },
    method: 'POST',
    originalUrl: '/api/test',
  };
  const res = createResponseMock();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Validation error');
  assert.deepEqual(res.payload.details, [
    {
      field: 'enabled',
      message: 'Expected boolean, received string',
    },
  ]);
});

test('validateBody delegates to validateRequest body validation', () => {
  const middleware = validateBody(z.object({
    count: z.number().int().min(1),
  }).strict());

  const req = {
    body: { count: 2 },
    method: 'POST',
    originalUrl: '/api/test',
  };
  const res = createResponseMock();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, { count: 2 });
});
