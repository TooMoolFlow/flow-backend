import test from 'node:test';
import assert from 'node:assert/strict';

import { getHealthyContentBank } from './healthy-content-bank.service.js';
import { validateRecommendationRecord } from './healthy-safety.service.js';

test('healthy content bank contains unique content keys', () => {
  const bank = getHealthyContentBank();
  const keys = bank.map((item) => item.contentKey);

  assert.ok(bank.length > 0);
  assert.equal(new Set(keys).size, keys.length);
});

test('healthy content bank entries are pre-approved and safe for end user output', () => {
  const bank = getHealthyContentBank();

  for (const item of bank) {
    assert.equal(item.status, 'approved', `Unexpected status for ${item.contentKey}`);
    assert.equal(item.locale, 'ru', `Unexpected locale for ${item.contentKey}`);
    assert.ok(Array.isArray(item.metricTags), `metricTags must be array for ${item.contentKey}`);
    assert.ok(Array.isArray(item.periodTags), `periodTags must be array for ${item.contentKey}`);

    const validation = validateRecommendationRecord(item);
    assert.equal(validation.ok, true, `Unsafe content bank item: ${item.contentKey}`);
  }
});

test('healthy content bank covers low-data and positive-support fallbacks', () => {
  const bank = getHealthyContentBank();
  const tags = bank.flatMap((item) => item.metricTags);

  assert.ok(tags.includes('low_data'));
  assert.ok(tags.includes('positive_support'));
  assert.ok(tags.includes('recovery'));
});

