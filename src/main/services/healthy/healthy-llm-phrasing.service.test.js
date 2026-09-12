import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_ENGINE_VERSION,
  default as HealthyLlmPhrasingService,
  buildHealthyPhrasingPrompt,
  extractPhrasingJsonObject,
  mergePhrasedInsightPayload,
} from './healthy-llm-phrasing.service.js';

const basePayload = {
  period: 'week',
  lowData: false,
  statusLabel: 'В балансе',
  statusTone: 'neutral',
  weakPoints: [{ id: 'steps', label: 'Мало движения' }],
  summary: 'Картина выглядит относительно ровной.',
  supportMessage: 'Небольшие спокойные шаги обычно работают лучше.',
  recommendations: [
    'Добавьте короткую прогулку в середине дня.',
    'Старайтесь держать воду под рукой.',
  ],
  improved: ['Активность к концу периода стала выше.'],
  worsened: [],
  strengths: ['Сон близок к цели.'],
  weaknessesNarrative: ['Мало движения'],
  weeklyFocus: 'Фокус недели: поддерживать базовый ритм.',
  monthlyDynamics: undefined,
  patternsLine: undefined,
  monthlyFocus: undefined,
};

test('mergePhrasedInsightPayload keeps rewritten safe fields', () => {
  const merged = mergePhrasedInsightPayload(basePayload, {
    summary: 'Неделя выглядит в целом ровно и устойчиво.',
    supportMessage: 'Лучше опираться на спокойные и посильные шаги.',
    recommendations: [
      'Добавьте недолгую прогулку в середине дня.',
      'Держите воду рядом, чтобы вспоминать о ней в течение дня.',
    ],
    improved: ['К концу периода активности стало немного больше.'],
    strengths: ['Сон по последним данным держится рядом с целью.'],
    weaknessesNarrative: ['Сейчас движению не всегда хватает регулярности.'],
    weeklyFocus: 'Фокус недели: удерживать базовый ритм без перегруза.',
  });

  assert.equal(merged.summary, 'Неделя выглядит в целом ровно и устойчиво.');
  assert.equal(merged.supportMessage, 'Лучше опираться на спокойные и посильные шаги.');
  assert.deepEqual(merged.recommendations, [
    'Добавьте недолгую прогулку в середине дня.',
    'Держите воду рядом, чтобы вспоминать о ней в течение дня.',
  ]);
  assert.equal(merged.weeklyFocus, 'Фокус недели: удерживать базовый ритм без перегруза.');
});

test('mergePhrasedInsightPayload falls back when array lengths do not match', () => {
  const merged = mergePhrasedInsightPayload(basePayload, {
    recommendations: ['Только один совет вместо двух.'],
    improved: ['К концу периода активности стало немного больше.'],
    worsened: ['Добавился лишний элемент'],
  });

  assert.deepEqual(merged.recommendations, basePayload.recommendations);
  assert.deepEqual(merged.improved, ['К концу периода активности стало немного больше.']);
  assert.deepEqual(merged.worsened, basePayload.worsened);
});

test('buildHealthyPhrasingPrompt encodes safety constraints for phrasing model', () => {
  const prompt = buildHealthyPhrasingPrompt(basePayload);

  assert.equal(prompt.includes('Не добавляй новые рекомендации'), true);
  assert.equal(prompt.includes('Нельзя упоминать: врачей, диагнозы, лекарства'), true);
  assert.equal(prompt.includes('"period": "week"'), true);
});

test('extractPhrasingJsonObject accepts markdown fenced JSON from model', () => {
  const raw = `
Here you go:
\`\`\`json
{"summary": "Кратко и мягко.", "recommendations": ["a", "b"]}
\`\`\`
`;
  const obj = extractPhrasingJsonObject(raw);
  assert.equal(obj.summary, 'Кратко и мягко.');
  assert.deepEqual(obj.recommendations, ['a', 'b']);
});

test('extractPhrasingJsonObject finds object inside noisy text', () => {
  const raw = 'prefix {"supportMessage": "Ок"} suffix';
  const obj = extractPhrasingJsonObject(raw);
  assert.equal(obj.supportMessage, 'Ок');
});

test('base engine version remains stable for fallback path', () => {
  assert.equal(BASE_ENGINE_VERSION, 'healthy-rules-v2');
});

test('phraseInsightPayload falls back to rules payload when Gemini is not configured', async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousFlag = process.env.HEALTHY_LLM_PHRASING_ENABLED;

  delete process.env.GEMINI_API_KEY;
  delete process.env.HEALTHY_LLM_PHRASING_ENABLED;

  try {
    const result = await HealthyLlmPhrasingService.phraseInsightPayload(basePayload);

    assert.equal(result.ok, false);
    assert.equal(result.engineVersion, BASE_ENGINE_VERSION);
    assert.equal(result.fallbackReason, 'llm_not_configured');
    assert.deepEqual(result.payload, basePayload);
  } finally {
    if (previousGeminiKey == null) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = previousGeminiKey;
    }

    if (previousFlag == null) {
      delete process.env.HEALTHY_LLM_PHRASING_ENABLED;
    } else {
      process.env.HEALTHY_LLM_PHRASING_ENABLED = previousFlag;
    }
  }
});
