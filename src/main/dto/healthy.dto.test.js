import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HEALTHY_API_VERSION,
  parseHealthyInsightQuery,
  parseHealthyRegenerateRequest,
  parseHealthySyncRequest,
  toHealthyInsightDto,
  toHealthyProfileDto,
  toHealthySyncResultDto,
} from './healthy.dto.js';

test('parseHealthySyncRequest applies version default and validates metrics', () => {
  const parsed = parseHealthySyncRequest({
    metrics: [
      {
        date: '2026-04-13',
        sleep_minutes: 420,
        sleep_rating: 'ok',
        data_sources: { manual: true },
      },
    ],
  });

  assert.equal(parsed.version, HEALTHY_API_VERSION);
  assert.equal(parsed.metrics.length, 1);
  assert.equal(parsed.metrics[0].date, '2026-04-13');
});

test('parseHealthyInsightQuery applies default period', () => {
  const parsed = parseHealthyInsightQuery({});
  assert.equal(parsed.period, 'day');
});

test('parseHealthyRegenerateRequest validates period and version', () => {
  const parsed = parseHealthyRegenerateRequest({ period: 'month' });
  assert.equal(parsed.version, HEALTHY_API_VERSION);
  assert.equal(parsed.period, 'month');
});

test('toHealthyProfileDto returns versioned profile payload', () => {
  const dto = toHealthyProfileDto({
    user_id: 7,
    sleep_goal_minutes: 480,
    steps_goal: 10000,
    weight_kg: '72.50',
    height_cm: '180.00',
    health_data_consent: true,
    apple_health_enabled: true,
    sleep_notifications_enabled: true,
    steps_notifications_enabled: true,
    no_activity_interval_hours: 2,
    created_at: '2026-04-13T10:00:00.000Z',
    updated_at: '2026-04-13T10:00:00.000Z',
  });

  assert.equal(dto.version, HEALTHY_API_VERSION);
  assert.equal(dto.profile.user_id, 7);
});

test('toHealthySyncResultDto returns versioned sync result', () => {
  const dto = toHealthySyncResultDto({
    ok: true,
    synced_dates: ['2026-04-13'],
    profile_updated: true,
  });

  assert.equal(dto.version, HEALTHY_API_VERSION);
  assert.deepEqual(dto.sync_result.synced_dates, ['2026-04-13']);
});

test('toHealthyInsightDto returns stable healthy.v1 shape', () => {
  const dto = toHealthyInsightDto({
    generated_at: '2026-04-13T12:00:00.000Z',
    engine_version: 'healthy-rules-v2',
    period: 'week',
    lowData: false,
    missingHints: [],
    statusLabel: 'В балансе',
    statusTone: 'neutral',
    summary: 'Неделя выглядит ровно.',
    weakPoints: [{ id: 'steps', label: 'Мало движения' }],
    improved: ['Сон стал стабильнее.'],
    worsened: [],
    recommendations: ['Добавьте короткую прогулку в середине дня.'],
    supportMessage: 'Небольшие шаги уже полезны.',
    weeklyFocus: 'Фокус недели: движение.',
    monthlyDynamics: undefined,
    strengths: ['Сон близок к цели.'],
    weaknessesNarrative: ['Иногда не хватает движения.'],
    patternsLine: undefined,
    monthlyFocus: undefined,
    dynamicsLabel: 'stable',
    dynamicsSummary: 'Относительно прошлого периода картина похожая.',
    vsPreviousPeriod: ['Шаги в среднем ниже относительно цели, чем в прошлом периоде.'],
    metricLinks: [],
    helpfulHabits: [],
    rationale: 'Статус отражает доступные отметки без резких провалов.',
    positiveHighlight: 'Сон по последним данным близок к цели.',
    actionToday: '',
  });

  assert.equal(dto.version, HEALTHY_API_VERSION);
  assert.equal(dto.period, 'week');
  assert.equal(dto.weakPoints[0].id, 'steps');
  assert.equal(dto.dynamicsLabel, 'stable');
  assert.equal(dto.vsPreviousPeriod.length, 1);
});

