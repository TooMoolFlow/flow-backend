import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarDayDelta,
  comparePeriodDynamics,
  computeWindowSignals,
  formatRowDate,
} from './healthy-insight-signals.js';

test('calendarDayDelta counts inclusive calendar difference', () => {
  assert.equal(calendarDayDelta('2026-05-01', '2026-05-02'), 1);
  assert.equal(calendarDayDelta('2026-05-01', '2026-05-01'), 0);
});

test('computeWindowSignals aggregates mood and sleep ratios', () => {
  const profile = { sleep_goal_minutes: 480, steps_goal: 10000 };
  const rows = [
    { sleep_minutes: 500, mood_value: 60, steps_count: 9000, stress_level: 'low', energy_level: 'medium' },
    { sleep_minutes: 400, mood_value: 40, steps_count: 3000, stress_level: 'high', energy_level: 'low' },
  ];
  const s = computeWindowSignals(rows, profile);
  assert.equal(s.moodCount, 2);
  assert.ok(s.avgMood != null && s.avgMood > 45 && s.avgMood < 55);
  assert.ok(s.avgSleepRatio != null);
});

test('comparePeriodDynamics yields better when mood improves with enough points', () => {
  const profile = { sleep_goal_minutes: 480, steps_goal: 10000 };
  const cur = computeWindowSignals(
    [
      { mood_value: 70, sleep_minutes: 480, stress_level: 'low' },
      { mood_value: 72, sleep_minutes: 490, stress_level: 'low' },
      { mood_value: 71, sleep_minutes: 485, stress_level: 'medium' },
    ],
    profile
  );
  const prev = computeWindowSignals(
    [
      { mood_value: 50, sleep_minutes: 420, stress_level: 'medium' },
      { mood_value: 52, sleep_minutes: 430, stress_level: 'high' },
      { mood_value: 51, sleep_minutes: 425, stress_level: 'medium' },
    ],
    profile
  );
  const d = comparePeriodDynamics(cur, prev, 'week');
  assert.equal(d.dynamicsLabel, 'better');
  assert.ok(Array.isArray(d.vsPreviousPeriod));
});

test('formatRowDate handles string dates', () => {
  assert.equal(formatRowDate({ date: '2026-04-13' }), '2026-04-13');
});
