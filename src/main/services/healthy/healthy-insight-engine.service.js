import { Op } from 'sequelize';
import {
  HealthyGenerationLog,
  HealthyInsightSnapshot,
  HealthyMetricDaily,
} from '../../models/init.model.js';
import { NotFoundError } from '../../errors/errors.js';
import HealthyProfileService from './healthy-profile.service.js';
import HealthyRecommendationService from './healthy-recommendation.service.js';
import HealthyLlmPhrasingService from './healthy-llm-phrasing.service.js';
import { validateInsightPayload } from './healthy-safety.service.js';
import {
  avg,
  buildHelpfulHabits,
  buildMetricLinks,
  buildPositiveHighlight,
  buildRationale,
  buildSparklines,
  comparePeriodDynamics,
  computeWindowSignals,
} from './healthy-insight-signals.js';

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysCalendar(date, delta) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + delta);
  return d;
}

/** Current + previous windows (same length), aligned with sync granularity (calendar dates). */
export function getPeriodWindows(period) {
  const end = startOfDay(new Date());
  if (period === 'day') {
    return {
      current: { start: end, end },
      previous: { start: addDaysCalendar(end, -1), end: addDaysCalendar(end, -1) },
    };
  }
  if (period === 'week') {
    const currentStart = addDaysCalendar(end, -6);
    const prevEnd = addDaysCalendar(end, -7);
    const prevStart = addDaysCalendar(end, -13);
    return {
      current: { start: currentStart, end },
      previous: { start: prevStart, end: prevEnd },
    };
  }
  const currentStart = addDaysCalendar(end, -29);
  const prevEnd = addDaysCalendar(end, -30);
  const prevStart = addDaysCalendar(end, -59);
  return {
    current: { start: currentStart, end },
    previous: { start: prevStart, end: prevEnd },
  };
}

function uniq(arr) {
  return [...new Set(arr)];
}

function pickStatus({ lowData, weakPoints, positiveSignals }) {
  if (lowData) {
    return { statusLabel: 'Мало данных', statusTone: 'neutral' };
  }
  if (weakPoints.length >= 2) {
    return { statusLabel: 'Нужно внимание', statusTone: 'attention' };
  }
  if (positiveSignals >= 2 && weakPoints.length === 0) {
    return { statusLabel: 'Хорошая динамика', statusTone: 'positive' };
  }
  return { statusLabel: 'В балансе', statusTone: 'neutral' };
}

function buildWeakPoints(rows, profile) {
  const lastRow = rows.at(-1) ?? null;
  if (!lastRow) return [];
  const weakPoints = [];

  if ((lastRow.sleep_minutes ?? profile.sleep_goal_minutes) < profile.sleep_goal_minutes * 0.8) {
    weakPoints.push({ id: 'sleep', label: 'Сон ниже цели' });
  }
  if ((lastRow.water_ml ?? 0) > 0 && (lastRow.water_goal_ml ?? 0) > 0 && lastRow.water_ml < lastRow.water_goal_ml * 0.65) {
    weakPoints.push({ id: 'water', label: 'Мало жидкости' });
  }
  if ((lastRow.steps_count ?? 0) > 0 && (profile.steps_goal ?? 0) > 0 && lastRow.steps_count < profile.steps_goal * 0.65) {
    weakPoints.push({ id: 'steps', label: 'Мало движения' });
  }
  if (lastRow.stress_level === 'high') {
    weakPoints.push({ id: 'stress', label: 'Повышенный стресс' });
  }
  if (lastRow.energy_level === 'low') {
    weakPoints.push({ id: 'energy', label: 'Низкая энергия' });
  }
  if ((lastRow.mood_value ?? 50) < 40) {
    weakPoints.push({ id: 'mood', label: 'Настроение ниже обычного' });
  }

  return weakPoints.slice(0, 3);
}

function buildPayload(period, currentRows, previousRows, profile) {
  const sortedCurrent = [...currentRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const sortedPrev = [...previousRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const weakPoints = buildWeakPoints(sortedCurrent, profile);
  const lowData =
    sortedCurrent.length === 0
    || avg(sortedCurrent.map((row) => Number(row.completeness_score) || 0)) < 25;
  const lastRow = sortedCurrent.at(-1) ?? null;

  const positiveSignals = [
    (lastRow?.sleep_minutes ?? 0) >= profile.sleep_goal_minutes * 0.95,
    (lastRow?.steps_count ?? 0) >= (profile.steps_goal ?? 0) * 0.9 && (profile.steps_goal ?? 0) > 0,
    (lastRow?.water_ml ?? 0) >= (lastRow?.water_goal_ml ?? 0) * 0.9 && (lastRow?.water_goal_ml ?? 0) > 0,
    lastRow?.stress_level === 'low',
    lastRow?.energy_level === 'high',
    (lastRow?.mood_value ?? 0) >= 60,
  ].filter(Boolean).length;

  const status = pickStatus({ lowData, weakPoints, positiveSignals });

  let summary = 'Данных пока недостаточно для точного вывода.';
  if (!lowData && status.statusTone === 'positive') {
    summary = 'По доступным данным состояние выглядит устойчиво: вы держите хороший базовый ритм.';
  } else if (!lowData && status.statusTone === 'attention') {
    summary = 'Есть несколько зон внимания, где мягкие изменения могут заметно улучшить самочувствие.';
  } else if (!lowData) {
    summary = 'Картина выглядит относительно ровной без резких провалов по основным метрикам.';
  }

  const improved = [];
  const worsened = [];
  const strengths = [];
  const weaknessesNarrative = [];

  if (period !== 'day' && sortedCurrent.length >= 2) {
    const firstHalf = sortedCurrent.slice(0, Math.ceil(sortedCurrent.length / 2));
    const secondHalf = sortedCurrent.slice(Math.ceil(sortedCurrent.length / 2));
    if (avg(secondHalf.map((row) => row.steps_count ?? 0)) > avg(firstHalf.map((row) => row.steps_count ?? 0)) * 1.1) {
      improved.push('Активность к концу периода стала выше.');
    }
    if (avg(secondHalf.map((row) => row.mood_value ?? 0)) < avg(firstHalf.map((row) => row.mood_value ?? 0)) - 5) {
      worsened.push('Настроение к концу периода ощущалось тяжелее.');
    }
  }

  if ((lastRow?.stress_level ?? null) === 'low') strengths.push('Напряжение по последним отметкам остается управляемым.');
  if ((lastRow?.sleep_minutes ?? 0) >= profile.sleep_goal_minutes * 0.95) strengths.push('Сон по последним данным близок к цели.');
  if ((lastRow?.steps_count ?? 0) >= (profile.steps_goal ?? 0) * 0.9 && (profile.steps_goal ?? 0) > 0) {
    strengths.push('Движение держится рядом с вашей целью.');
  }

  for (const weakPoint of weakPoints) {
    weaknessesNarrative.push(weakPoint.label);
  }

  const curSignals = computeWindowSignals(sortedCurrent, profile);
  const prevSignals = computeWindowSignals(sortedPrev, profile);
  const dynamics = comparePeriodDynamics(curSignals, prevSignals, period);

  const metricRatios = {
    cur: {
      sleep: curSignals.avgSleepRatio,
      mood: curSignals.avgMood != null ? Math.min(1, curSignals.avgMood / 100) : null,
      steps: curSignals.avgStepsRatio,
      stressHigh: curSignals.stressHighShare,
    },
    prev: {
      sleep: prevSignals.avgSleepRatio,
      mood: prevSignals.avgMood != null ? Math.min(1, prevSignals.avgMood / 100) : null,
      steps: prevSignals.avgStepsRatio,
      stressHigh: prevSignals.stressHighShare,
    },
  };

  const sparklines = !lowData ? buildSparklines(sortedCurrent, profile) : null;

  let metricLinks = [];
  let helpfulHabits = [];
  if (!lowData) {
    const minForLinks = period === 'month' ? 10 : period === 'week' ? 5 : 4;
    if (sortedCurrent.length >= minForLinks) {
      metricLinks = buildMetricLinks(sortedCurrent, profile);
    }
    const minForHabits = period === 'month' ? 12 : period === 'week' ? 7 : 5;
    if (sortedCurrent.length >= minForHabits) {
      helpfulHabits = buildHelpfulHabits(sortedCurrent, profile);
    }
  }

  const rationale = buildRationale({
    period,
    lowData,
    statusTone: status.statusTone,
    weakPoints,
    dynamicsLabel: dynamics.dynamicsLabel,
    dynamicsSummary: dynamics.dynamicsSummary,
  });

  const positiveHighlight = buildPositiveHighlight({
    lowData,
    statusTone: status.statusTone,
    strengths,
    weakPoints,
    dynamicsLabel: dynamics.dynamicsLabel,
  });

  let monthlyDynamicsLine;
  if (period === 'month' && !lowData) {
    monthlyDynamicsLine = `${dynamics.dynamicsSummary} Личный ритм лучше читается там, где данные отмечались регулярно.`;
  } else if (period === 'month' && lowData) {
    monthlyDynamicsLine = dynamics.dynamicsSummary;
  }

  return {
    period,
    lowData,
    missingHints: lowData ? ['сон', 'вода', 'шаги', 'самочувствие'] : [],
    statusLabel: status.statusLabel,
    statusTone: status.statusTone,
    summary,
    weakPoints,
    improved,
    worsened,
    recommendations: [],
    supportMessage: status.statusTone === 'positive'
      ? 'Хороший темп. Сохраняйте привычки, которые уже помогают вам держать опору.'
      : lowData
        ? 'Даже несколько коротких отметок в день быстро улучшают качество анализа.'
        : 'Небольшие спокойные шаги обычно работают лучше, чем резкие перестройки.',
    weeklyFocus: period === 'week'
      ? weakPoints[0]?.id === 'sleep'
        ? 'Фокус недели: выровнять сон и вечерний ритм.'
        : weakPoints[0]?.id === 'stress'
          ? 'Фокус недели: короткие паузы и восстановление в течение дня.'
          : 'Фокус недели: поддерживать базовый ритм сна, воды и движения.'
      : undefined,
    monthlyDynamics: monthlyDynamicsLine,
    strengths,
    weaknessesNarrative,
    patternsLine: period === 'month'
      ? lowData
        ? 'Пока мало повторяющихся данных, чтобы уверенно говорить о паттернах.'
        : 'По месяцу видно, какие опоры для вас повторяются чаще — это отправная точка без спешки.'
      : undefined,
    monthlyFocus: period === 'month'
      ? weakPoints[0]?.id === 'energy'
        ? 'Фокус месяца: восстановление и более ровная энергия.'
        : 'Фокус месяца: удерживать базовые привычки без перегруза.'
      : undefined,
    dynamicsLabel: dynamics.dynamicsLabel,
    dynamicsSummary: dynamics.dynamicsSummary,
    vsPreviousPeriod: dynamics.vsPreviousPeriod,
    metricLinks,
    helpfulHabits,
    rationale,
    positiveHighlight,
    actionToday: '',
    metricRatios,
    sparklines,
  };
}

class HealthyInsightEngineService {
  static async getRowsForDateRange(userId, rangeStart, rangeEnd) {
    return HealthyMetricDaily.findAll({
      where: {
        user_id: userId,
        date: {
          [Op.between]: [formatDateOnly(rangeStart), formatDateOnly(rangeEnd)],
        },
      },
      order: [['date', 'ASC']],
    });
  }

  static async generateForUser(userId, period) {
    const startedAt = Date.now();
    const profile = await HealthyProfileService.getOrCreateProfile(userId);
    const windows = getPeriodWindows(period);
    const currentRows = await this.getRowsForDateRange(userId, windows.current.start, windows.current.end);
    const previousRows = await this.getRowsForDateRange(userId, windows.previous.start, windows.previous.end);
    let payload = buildPayload(period, currentRows, previousRows, profile);

    const recommendationMetricTags = payload.lowData
      ? ['low_data']
      : uniq([...payload.weakPoints.map((item) => item.id), payload.statusTone === 'positive' ? 'positive_support' : 'recovery']);
    const recommendations = await HealthyRecommendationService.selectRecommendations({
      metricTags: recommendationMetricTags,
      period,
      limit: period === 'day' ? 2 : 3,
    });

    payload.recommendations = recommendations.map((item) => item.text);
    payload.actionToday =
      period === 'day' && !payload.lowData && payload.recommendations[0]
        ? payload.recommendations[0]
        : '';

    const phrasingResult = await HealthyLlmPhrasingService.phraseInsightPayload(payload);
    payload = phrasingResult.payload;

    const safety = validateInsightPayload(payload);
    const now = new Date();
    const periodEnd = startOfDay(new Date());
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodEnd.getDate() - (period === 'day' ? 0 : period === 'week' ? 6 : 29));

    await HealthyGenerationLog.create({
      user_id: userId,
      period_type: period,
      period_start: formatDateOnly(periodStart),
      period_end: formatDateOnly(periodEnd),
      success: safety.ok,
      model_used: phrasingResult.modelUsed,
      engine_version: phrasingResult.engineVersion,
      fallback_reason: safety.ok
        ? phrasingResult.fallbackReason
        : phrasingResult.fallbackReason || 'blocked_topics_detected',
      blocked_topics: safety.ok
        ? phrasingResult.blockedTopics
        : [...new Set([...(phrasingResult.blockedTopics ?? []), ...safety.blockedTopics])],
      safety_decisions: {
        validator: 'healthy-safety.service',
        blocked: !safety.ok,
        llmPhrasingApplied: phrasingResult.ok,
      },
      latency_ms: Date.now() - startedAt,
      error_message: safety.ok ? null : 'Insight payload contains blocked topics',
    });

    if (!safety.ok) {
      throw new NotFoundError('Не удалось безопасно сформировать insight.');
    }

    const [snapshot] = await HealthyInsightSnapshot.findOrCreate({
      where: {
        user_id: userId,
        period_type: period,
        period_start: formatDateOnly(periodStart),
        period_end: formatDateOnly(periodEnd),
      },
      defaults: {
        user_id: userId,
        period_type: period,
        period_start: formatDateOnly(periodStart),
        period_end: formatDateOnly(periodEnd),
        status_label: payload.statusLabel,
        status_tone: payload.statusTone,
        summary: payload.summary,
        weak_points_json: payload.weakPoints,
        recommendation_ids_json: recommendations.map((item) => item.id),
        support_message: payload.supportMessage,
        low_data_flag: payload.lowData,
        payload,
        engine_version: phrasingResult.engineVersion,
        generated_at: now,
      },
    });

    await snapshot.update({
      status_label: payload.statusLabel,
      status_tone: payload.statusTone,
      summary: payload.summary,
      weak_points_json: payload.weakPoints,
      recommendation_ids_json: recommendations.map((item) => item.id),
      support_message: payload.supportMessage,
      low_data_flag: payload.lowData,
      payload,
      engine_version: phrasingResult.engineVersion,
      generated_at: now,
    });

    return snapshot;
  }

  static async getLatestForUser(userId, period) {
    const existing = await this.generateForUser(userId, period);
    return {
      generated_at: existing.generated_at,
      engine_version: existing.engine_version,
      ...existing.payload,
    };
  }
}

export default HealthyInsightEngineService;
