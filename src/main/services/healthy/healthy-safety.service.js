const ALLOWED_METRICS = new Set([
  'sleep',
  'water',
  'steps',
  'mood',
  'energy',
  'stress',
  'recovery',
  'low_data',
  'positive_support',
]);

const BLOCKED_PATTERNS = [
  /секс/iu,
  /алкогол/iu,
  /сигарет/iu,
  /вейп/iu,
  /никотин/iu,
  /наркот/iu,
  /лекарств/iu,
  /препарат/iu,
  /диагноз/iu,
  /врач/iu,
  /терапевт/iu,
  /антидепресс/iu,
  /курени/iu,
];

export function validateMetricTags(metricTags = []) {
  return metricTags.every((tag) => ALLOWED_METRICS.has(tag));
}

export function scanTextForBlockedTopics(text = '') {
  const blockedTopics = [];
  for (const pattern of BLOCKED_PATTERNS) {
    const match = text.match(pattern);
    if (match) blockedTopics.push(match[0].toLowerCase());
  }
  return [...new Set(blockedTopics)];
}

export function validateRecommendationRecord(record) {
  const blockedTopics = scanTextForBlockedTopics(record?.text ?? '');
  return {
    ok: validateMetricTags(record?.metricTags ?? []) && blockedTopics.length === 0,
    blockedTopics,
  };
}

export function validateInsightPayload(payload) {
  const texts = [
    payload?.summary,
    payload?.supportMessage,
    ...(Array.isArray(payload?.recommendations) ? payload.recommendations : []),
    ...(Array.isArray(payload?.improved) ? payload.improved : []),
    ...(Array.isArray(payload?.worsened) ? payload.worsened : []),
    ...(Array.isArray(payload?.strengths) ? payload.strengths : []),
    ...(Array.isArray(payload?.weaknessesNarrative) ? payload.weaknessesNarrative : []),
    payload?.weeklyFocus,
    payload?.monthlyDynamics,
    payload?.monthlyFocus,
    payload?.patternsLine,
    payload?.rationale,
    payload?.positiveHighlight,
    payload?.actionToday,
    payload?.dynamicsSummary,
    ...(Array.isArray(payload?.vsPreviousPeriod) ? payload.vsPreviousPeriod : []),
    ...(Array.isArray(payload?.metricLinks) ? payload.metricLinks : []),
    ...(Array.isArray(payload?.helpfulHabits) ? payload.helpfulHabits : []),
  ].filter(Boolean);

  const blockedTopics = texts.flatMap((text) => scanTextForBlockedTopics(text));
  return {
    ok: blockedTopics.length === 0,
    blockedTopics: [...new Set(blockedTopics)],
  };
}

