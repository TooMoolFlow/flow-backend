/**
 * Deterministic personalization signals for Healthy insights (stage 2).
 * No medical claims; correlations phrased as observations from logged data.
 */

export function avg(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatRowDate(row) {
  const raw = row?.date;
  if (!raw) return '';
  if (typeof raw === 'string') return raw.slice(0, 10);
  try {
    return raw.toISOString().slice(0, 10);
  } catch {
    return String(raw).slice(0, 10);
  }
}

/** @returns {number | null} calendar days from a to b (b - a), YYYY-MM-DD */
export function calendarDayDelta(isoA, isoB) {
  const parse = (s) => {
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    return Date.UTC(y, m - 1, d);
  };
  if (!isoA || !isoB || isoA.length < 10 || isoB.length < 10) return null;
  const ms = parse(isoB) - parse(isoA);
  return Math.round(ms / 86400000);
}

export function computeWindowSignals(rows, profile) {
  const sleepGoal = profile.sleep_goal_minutes ?? 480;
  const stepsGoal = profile.steps_goal ?? 0;

  const sleepRatios = [];
  for (const r of rows) {
    if (r.sleep_minutes != null && sleepGoal > 0) {
      sleepRatios.push(Math.min(1.25, r.sleep_minutes / sleepGoal));
    }
  }

  const moods = rows.map((r) => r.mood_value).filter((v) => v != null && Number.isFinite(Number(v)));
  const moodNums = moods.map((v) => Number(v));

  const stepRatios = [];
  if (stepsGoal > 0) {
    for (const r of rows) {
      if (r.steps_count != null) {
        stepRatios.push(Math.min(1.25, r.steps_count / stepsGoal));
      }
    }
  }

  const stressTagged = rows.filter((r) => r.stress_level != null);
  const stressHighShare = stressTagged.length
    ? stressTagged.filter((r) => r.stress_level === 'high').length / stressTagged.length
    : null;

  const energyTagged = rows.filter((r) => r.energy_level != null);
  const energyLowShare = energyTagged.length
    ? energyTagged.filter((r) => r.energy_level === 'low').length / energyTagged.length
    : null;

  return {
    avgSleepRatio: avg(sleepRatios),
    avgMood: avg(moodNums),
    moodCount: moodNums.length,
    avgStepsRatio: avg(stepRatios),
    stepsCount: stepRatios.length,
    stressHighShare,
    stressTaggedCount: stressTagged.length,
    energyLowShare,
    energyTaggedCount: energyTagged.length,
    rowCount: rows.length,
  };
}

/**
 * Compare current vs previous window → dynamicsLabel + copy for UI.
 */
export function comparePeriodDynamics(currentSignals, previousSignals, period) {
  const vsPreviousPeriod = [];
  let scoreDelta = 0;
  let parts = 0;

  const moodCur = currentSignals.avgMood;
  const moodPrev = previousSignals.avgMood;
  const moodThreshold = period === 'day' ? 1 : period === 'week' ? 2 : 3;

  if (
    moodCur != null
    && moodPrev != null
    && currentSignals.moodCount >= moodThreshold
    && previousSignals.moodCount >= moodThreshold
  ) {
    const d = moodCur - moodPrev;
    scoreDelta += Math.max(-20, Math.min(20, d));
    parts += 1;
    if (d >= 6) {
      vsPreviousPeriod.push('Настроение по отметкам в среднем выше, чем в прошлом периоде.');
    } else if (d <= -6) {
      vsPreviousPeriod.push('Настроение по отметкам в среднем ниже, чем в прошлом периоде.');
    }
  }

  const sleepCur = currentSignals.avgSleepRatio;
  const sleepPrev = previousSignals.avgSleepRatio;
  const sleepMinPairs =
    period === 'day' ? 1 : period === 'week' ? 3 : 5;

  if (
    sleepCur != null
    && sleepPrev != null
    && currentSignals.rowCount >= sleepMinPairs
    && previousSignals.rowCount >= sleepMinPairs
  ) {
    const d = (sleepCur - sleepPrev) * 50;
    scoreDelta += Math.max(-15, Math.min(15, d));
    parts += 1;
    const pct = (sleepCur - sleepPrev) * 100;
    if (pct >= 6) {
      vsPreviousPeriod.push('Сон в среднем ближе к вашей цели, чем в прошлом периоде.');
    } else if (pct <= -6) {
      vsPreviousPeriod.push('Сон в среднем дальше от цели, чем в прошлом периоде.');
    }
  }

  const stepsCur = currentSignals.avgStepsRatio;
  const stepsPrev = previousSignals.avgStepsRatio;
  if (
    stepsCur != null
    && stepsPrev != null
    && currentSignals.stepsCount >= sleepMinPairs
    && previousSignals.stepsCount >= sleepMinPairs
  ) {
    const d = (stepsCur - stepsPrev) * 40;
    scoreDelta += Math.max(-15, Math.min(15, d));
    parts += 1;
    const pct = (stepsCur - stepsPrev) * 100;
    if (pct >= 8) {
      vsPreviousPeriod.push('Шаги в среднем выше относительно цели, чем в прошлом периоде.');
    } else if (pct <= -8) {
      vsPreviousPeriod.push('Шаги в среднем ниже относительно цели, чем в прошлом периоде.');
    }
  }

  const stressCur = currentSignals.stressHighShare;
  const stressPrev = previousSignals.stressHighShare;
  if (
    stressCur != null
    && stressPrev != null
    && currentSignals.stressTaggedCount >= moodThreshold
    && previousSignals.stressTaggedCount >= moodThreshold
  ) {
    const d = (stressPrev - stressCur) * 25;
    scoreDelta += Math.max(-15, Math.min(15, d));
    parts += 1;
    if (stressCur + 0.12 < stressPrev) {
      vsPreviousPeriod.push('Доля дней с высоким стрессом по отметкам снизилась относительно прошлого периода.');
    } else if (stressCur > stressPrev + 0.12) {
      vsPreviousPeriod.push('Доля дней с высоким стрессом по отметкам выше, чем в прошлом периоде.');
    }
  }

  if (parts === 0) {
    return {
      dynamicsLabel: 'stable',
      dynamicsSummary: 'Для сравнения с прошлым периодом пока мало пересекающихся данных.',
      vsPreviousPeriod: [],
    };
  }

  const combined = scoreDelta / parts;
  let dynamicsLabel = 'stable';
  let dynamicsSummary = 'Относительно прошлого периода картина похожая: без выраженного сдвига.';

  if (combined >= 5) {
    dynamicsLabel = 'better';
    dynamicsSummary = 'Относительно прошлого периода показатели по вашим данным выглядят лучше.';
  } else if (combined <= -5) {
    dynamicsLabel = 'worse';
    dynamicsSummary = 'Относительно прошлого периода несколько опор просели — это можно смягчать маленькими шагами.';
  }

  const uniqVs = [...new Set(vsPreviousPeriod)].slice(0, 3);

  return {
    dynamicsLabel,
    dynamicsSummary,
    vsPreviousPeriod: uniqVs,
  };
}

export function buildMetricLinks(sortedRows, profile) {
  const links = [];
  const sleepGoal = profile.sleep_goal_minutes ?? 480;
  if (!sortedRows.length || sleepGoal <= 0) return links;

  const byDate = new Map(sortedRows.map((r) => [formatRowDate(r), r]));

  let goodSleepNextEnergyOk = 0;
  let goodSleepPairs = 0;
  let poorSleepNextEnergyLow = 0;
  let poorSleepPairs = 0;
  let highStepsNextMoodHigh = 0;
  let highStepsPairs = 0;

  const dates = [...byDate.keys()].filter(Boolean).sort();

  for (let i = 0; i < dates.length - 1; i += 1) {
    const d = dates[i];
    const next = dates[i + 1];
    if (calendarDayDelta(d, next) !== 1) continue;

    const row = byDate.get(d);
    const nextRow = byDate.get(next);
    if (!row || !nextRow) continue;

    const sleepMin = row.sleep_minutes;
    const ratio = sleepMin != null ? sleepMin / sleepGoal : null;

    if (ratio != null && ratio >= 0.88 && nextRow.energy_level != null) {
      goodSleepPairs += 1;
      if (nextRow.energy_level === 'high' || nextRow.energy_level === 'medium') {
        goodSleepNextEnergyOk += 1;
      }
    }
    if (ratio != null && ratio <= 0.72 && nextRow.energy_level != null) {
      poorSleepPairs += 1;
      if (nextRow.energy_level === 'low') {
        poorSleepNextEnergyLow += 1;
      }
    }

    const sg = profile.steps_goal ?? 0;
    if (sg > 0 && row.steps_count != null && nextRow.mood_value != null) {
      if (row.steps_count >= sg * 0.85) {
        highStepsPairs += 1;
        if (nextRow.mood_value >= 52) {
          highStepsNextMoodHigh += 1;
        }
      }
    }
  }

  if (goodSleepPairs >= 4 && goodSleepNextEnergyOk / goodSleepPairs >= 0.55) {
    links.push(
      'По вашим отметкам после ночей с сном ближе к цели энергия на следующий день чаще ощущалась выше или средней.'
    );
  }
  if (poorSleepPairs >= 4 && poorSleepNextEnergyLow / poorSleepPairs >= 0.48) {
    links.push(
      'После более коротких ночей энергия на следующий день по данным чаще была ниже — это совпадение в журнале, не жёсткое правило.'
    );
  }
  if (highStepsPairs >= 4 && highStepsNextMoodHigh / highStepsPairs >= 0.5) {
    links.push(
      'В дни с более высокой активностью настроение на следующий день по отметкам чаще было светлее.'
    );
  }

  return links.slice(0, 3);
}

export function buildHelpfulHabits(sortedRows, profile) {
  const habits = [];
  const stepsGoal = profile.steps_goal ?? 0;
  const sleepGoal = profile.sleep_goal_minutes ?? 480;

  const waterOk = sortedRows.filter(
    (r) => (r.water_goal_ml ?? 0) > 0 && r.water_ml != null && r.water_ml >= r.water_goal_ml * 0.88
  );
  const waterWeak = sortedRows.filter(
    (r) => (r.water_goal_ml ?? 0) > 0 && r.water_ml != null && r.water_ml < r.water_goal_ml * 0.62
  );

  const moodOk = avg(waterOk.map((r) => r.mood_value).filter((v) => v != null).map(Number));
  const moodWeak = avg(waterWeak.map((r) => r.mood_value).filter((v) => v != null).map(Number));

  if (waterOk.length >= 3 && waterWeak.length >= 3 && moodOk != null && moodWeak != null && moodOk - moodWeak >= 7) {
    habits.push('В дни ближе к цели по воде настроение по вашим отметкам в среднем было выше.');
  }

  if (stepsGoal > 0) {
    const stepOk = sortedRows.filter((r) => r.steps_count != null && r.steps_count >= stepsGoal * 0.82);
    const stepWeak = sortedRows.filter((r) => r.steps_count != null && r.steps_count < stepsGoal * 0.45);
    const mOk = avg(stepOk.map((r) => r.mood_value).filter((v) => v != null).map(Number));
    const mWeak = avg(stepWeak.map((r) => r.mood_value).filter((v) => v != null).map(Number));
    if (stepOk.length >= 3 && stepWeak.length >= 3 && mOk != null && mWeak != null && mOk - mWeak >= 7) {
      habits.push('Когда шаги ближе к цели, настроение по журналу в среднем ровнее и светлее.');
    }
  }

  if (sleepGoal > 0) {
    const sleepOk = sortedRows.filter((r) => r.sleep_minutes != null && r.sleep_minutes >= sleepGoal * 0.9);
    const sleepWeak = sortedRows.filter((r) => r.sleep_minutes != null && r.sleep_minutes < sleepGoal * 0.72);
    const okTagged = sleepOk.filter((r) => r.stress_level != null);
    const weakTagged = sleepWeak.filter((r) => r.stress_level != null);
    if (okTagged.length >= 3 && weakTagged.length >= 3) {
      const rateHighOk = okTagged.filter((r) => r.stress_level === 'high').length / okTagged.length;
      const rateHighWeak = weakTagged.filter((r) => r.stress_level === 'high').length / weakTagged.length;
      if (rateHighWeak - rateHighOk >= 0.18) {
        habits.push('В дни с более достаточным сном по данным реже отмечался высокий стресс.');
      }
    }
  }

  return habits.slice(0, 3);
}

export function buildRationale({
  period,
  lowData,
  statusTone,
  weakPoints,
  dynamicsLabel,
  dynamicsSummary,
}) {
  const chunks = [];

  if (lowData) {
    chunks.push(
      'Вывод осторожный: за выбранный период мало пересекающихся отметок, поэтому статус отражает доступность данных.'
    );
    return chunks.join(' ');
  }

  chunks.push(
    statusTone === 'positive'
      ? 'Статус опирается на то, что несколько базовых метрик держатся в комфортной для вас зоне.'
      : statusTone === 'attention'
        ? 'Статус связан с тем, что одновременно несколько метрик указывают на зоны внимания.'
        : 'Статус отражает отсутствие резких провалов по ключевым отметкам без «идеальной» картины.'
  );

  if (weakPoints.length > 0) {
    const labels = weakPoints.slice(0, 2).map((w) => w.label.toLowerCase());
    chunks.push(`В первую очередь учтены: ${labels.join(' и ')}.`);
  }

  if (period !== 'day' && dynamicsLabel === 'better') {
    chunks.push('Дополнительно видно улучшение относительно вашего прошлого периода.');
  } else if (period !== 'day' && dynamicsLabel === 'worse') {
    chunks.push('Относительно прошлого периода по тем же данным есть небольшое проседание.');
  }

  if (period !== 'day' && dynamicsSummary && !chunks.some((c) => c.includes(dynamicsSummary))) {
    chunks.push(dynamicsSummary);
  }

  return chunks.join(' ').trim().slice(0, 900);
}

/**
 * Нормализованные временные ряды для sparkline.
 * Все значения приведены к диапазону 0–1.25 (для сна/шагов) или 0–1 (настроение).
 * null — данные за этот день отсутствуют.
 */
export function buildSparklines(sortedRows, profile) {
  const sleepGoal = profile.sleep_goal_minutes ?? 480;
  const stepsGoal = profile.steps_goal ?? 0;

  return {
    dates: sortedRows.map((r) => formatRowDate(r)),
    sleep: sortedRows.map((r) =>
      r.sleep_minutes != null && sleepGoal > 0
        ? Math.min(1.25, r.sleep_minutes / sleepGoal)
        : null
    ),
    mood: sortedRows.map((r) =>
      r.mood_value != null ? Math.min(1, Math.max(0, Number(r.mood_value) / 100)) : null
    ),
    steps: sortedRows.map((r) =>
      r.steps_count != null && stepsGoal > 0
        ? Math.min(1.25, r.steps_count / stepsGoal)
        : null
    ),
  };
}

export function buildPositiveHighlight({
  lowData,
  statusTone,
  strengths,
  weakPoints,
  dynamicsLabel,
}) {
  if (lowData) {
    return 'Вы уже делаете полезное — каждая отметка приближает персональный разбор.';
  }
  if (strengths.length > 0) {
    return strengths[0];
  }
  if (statusTone === 'positive') {
    return 'Есть устойчивые опоры в ваших ежедневных данных — это хорошая база.';
  }
  if (dynamicsLabel === 'better') {
    return 'Относительно прошлого периода заметен позитивный сдвиг по вашим же метрикам.';
  }
  if (weakPoints.length <= 1) {
    return 'Просадок немного — есть пространство для одного спокойного шага за раз.';
  }
  return 'Прогресс не всегда линейный; регулярные короткие отметки уже помогают видеть динамику.';
}
