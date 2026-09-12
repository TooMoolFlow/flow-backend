import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scanTextForBlockedTopics,
  validateInsightPayload,
  validateMetricTags,
  validateRecommendationRecord,
} from './healthy-safety.service.js';

test('validateMetricTags accepts only allowed healthy tags', () => {
  assert.equal(validateMetricTags(['sleep', 'water', 'recovery']), true);
  assert.equal(validateMetricTags(['sleep', 'diagnosis']), false);
});

test('scanTextForBlockedTopics catches forbidden medical and substance topics', () => {
  const blocked = scanTextForBlockedTopics(
    'Не используйте алкоголь и не ставьте себе диагнозы по этому совету.'
  );

  assert.deepEqual(blocked.sort(), ['алкогол', 'диагноз'].sort());
});

test('validateRecommendationRecord blocks unsafe recommendation text', () => {
  const validation = validateRecommendationRecord({
    metricTags: ['sleep'],
    text: 'При бессоннице обсудите лекарства с врачом.',
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.blockedTopics.includes('лекарств'), true);
  assert.equal(validation.blockedTopics.includes('врач'), true);
});

test('validateInsightPayload accepts safe healthy insight payload', () => {
  const validation = validateInsightPayload({
    summary: 'По данным за неделю картина выглядит ровной.',
    supportMessage: 'Спокойные шаги помогают держать устойчивый ритм.',
    recommendations: [
      'Старайтесь ложиться примерно в одно и то же время.',
      'Держите воду под рукой и пейте понемногу в течение дня.',
    ],
    improved: ['Активность к концу недели стала выше.'],
    worsened: [],
    strengths: ['Сон близок к цели.'],
    weaknessesNarrative: ['Иногда не хватает движения.'],
  });

  assert.deepEqual(validation, { ok: true, blockedTopics: [] });
});

test('validateInsightPayload rejects blocked topics in generated output', () => {
  const validation = validateInsightPayload({
    summary: 'Нужна осторожность и не стоит подбирать препараты самостоятельно.',
    supportMessage: 'При необходимости обсудите это с врачом.',
    recommendations: ['Избегайте алкоголя вечером.'],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.blockedTopics.includes('препарат'), true);
  assert.equal(validation.blockedTopics.includes('врач'), true);
  assert.equal(validation.blockedTopics.includes('алкогол'), true);
});

