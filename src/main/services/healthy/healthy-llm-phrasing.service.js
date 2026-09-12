import axios from 'axios';
import { z } from 'zod';
import logger from '../../utils/winston/logger.js';
import { logGeminiModelNotFound } from '../chat.service.js';
import { validateInsightPayload } from './healthy-safety.service.js';

const GEMINI_API_VERSION = 'v1';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const BASE_ENGINE_VERSION = 'healthy-rules-v2';
const PHRASING_ENGINE_VERSION = 'healthy-rules-v2+gemini-phrasing-v1';

const phrasedInsightSchema = z.object({
  summary: z.string().min(1).optional(),
  supportMessage: z.string().min(1).optional(),
  recommendations: z.array(z.string().min(1)).optional(),
  improved: z.array(z.string().min(1)).optional(),
  worsened: z.array(z.string().min(1)).optional(),
  strengths: z.array(z.string().min(1)).optional(),
  weaknessesNarrative: z.array(z.string().min(1)).optional(),
  weeklyFocus: z.string().min(1).optional(),
  monthlyDynamics: z.string().min(1).optional(),
  patternsLine: z.string().min(1).optional(),
  monthlyFocus: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  positiveHighlight: z.string().min(1).optional(),
  actionToday: z.string().optional(),
  dynamicsSummary: z.string().min(1).optional(),
  vsPreviousPeriod: z.array(z.string().min(1)).optional(),
  metricLinks: z.array(z.string().min(1)).optional(),
  helpfulHabits: z.array(z.string().min(1)).optional(),
}).strict();

function getModelName() {
  return process.env.GEMINI_MODEL_NAME || DEFAULT_MODEL;
}

function isPhrasingEnabled() {
  return process.env.HEALTHY_LLM_PHRASING_ENABLED !== 'false';
}

/**
 * Gemini REST `v1` rejects `generationConfig.responseMimeType` for some accounts/models.
 * We ask for JSON in the prompt and parse robustly from plain text (incl. markdown fences).
 */
export function extractPhrasingJsonObject(rawText = '') {
  let text = String(rawText).trim();
  const fence = text.match(/^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i);
  if (fence) {
    text = fence[1].trim();
  }

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('No JSON object found in LLM response');
  }

  return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
}

function normalizeText(value, fallbackValue) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallbackValue;
}

function normalizeTextArray(value, fallbackValue) {
  if (!Array.isArray(fallbackValue) || fallbackValue.length === 0) {
    return Array.isArray(fallbackValue) ? fallbackValue : [];
  }

  if (!Array.isArray(value) || value.length !== fallbackValue.length) {
    return fallbackValue;
  }

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);

  return normalized.length === fallbackValue.length ? normalized : fallbackValue;
}

export function mergePhrasedInsightPayload(basePayload, phrasedFields = {}) {
  return {
    ...basePayload,
    summary: normalizeText(phrasedFields.summary, basePayload.summary),
    supportMessage: normalizeText(phrasedFields.supportMessage, basePayload.supportMessage),
    recommendations: normalizeTextArray(phrasedFields.recommendations, basePayload.recommendations),
    improved: normalizeTextArray(phrasedFields.improved, basePayload.improved),
    worsened: normalizeTextArray(phrasedFields.worsened, basePayload.worsened),
    strengths: normalizeTextArray(phrasedFields.strengths, basePayload.strengths),
    weaknessesNarrative: normalizeTextArray(phrasedFields.weaknessesNarrative, basePayload.weaknessesNarrative),
    weeklyFocus: basePayload.weeklyFocus == null
      ? basePayload.weeklyFocus
      : normalizeText(phrasedFields.weeklyFocus, basePayload.weeklyFocus),
    monthlyDynamics: basePayload.monthlyDynamics == null
      ? basePayload.monthlyDynamics
      : normalizeText(phrasedFields.monthlyDynamics, basePayload.monthlyDynamics),
    patternsLine: basePayload.patternsLine == null
      ? basePayload.patternsLine
      : normalizeText(phrasedFields.patternsLine, basePayload.patternsLine),
    monthlyFocus: basePayload.monthlyFocus == null
      ? basePayload.monthlyFocus
      : normalizeText(phrasedFields.monthlyFocus, basePayload.monthlyFocus),
    rationale: basePayload.rationale == null || basePayload.rationale === ''
      ? basePayload.rationale
      : normalizeText(phrasedFields.rationale, basePayload.rationale),
    positiveHighlight: basePayload.positiveHighlight == null || basePayload.positiveHighlight === ''
      ? basePayload.positiveHighlight
      : normalizeText(phrasedFields.positiveHighlight, basePayload.positiveHighlight),
    actionToday: typeof basePayload.actionToday === 'string'
      ? (typeof phrasedFields.actionToday === 'string' && phrasedFields.actionToday.trim()
          ? phrasedFields.actionToday.trim()
          : basePayload.actionToday)
      : basePayload.actionToday,
    dynamicsSummary: basePayload.dynamicsSummary == null || basePayload.dynamicsSummary === ''
      ? basePayload.dynamicsSummary
      : normalizeText(phrasedFields.dynamicsSummary, basePayload.dynamicsSummary),
    vsPreviousPeriod: normalizeTextArray(phrasedFields.vsPreviousPeriod, basePayload.vsPreviousPeriod ?? []),
    metricLinks: normalizeTextArray(phrasedFields.metricLinks, basePayload.metricLinks ?? []),
    helpfulHabits: normalizeTextArray(phrasedFields.helpfulHabits, basePayload.helpfulHabits ?? []),
  };
}

export function buildPayloadSubsetForPhrasing(payload) {
  const subset = {
    period: payload.period,
    lowData: payload.lowData,
    statusLabel: payload.statusLabel,
    statusTone: payload.statusTone,
    weakPoints: payload.weakPoints,
    summary: payload.summary,
    supportMessage: payload.supportMessage,
    recommendations: payload.recommendations,
    improved: payload.improved,
    worsened: payload.worsened,
    strengths: payload.strengths,
    weaknessesNarrative: payload.weaknessesNarrative,
    weeklyFocus: payload.weeklyFocus,
    monthlyDynamics: payload.monthlyDynamics,
    patternsLine: payload.patternsLine,
    monthlyFocus: payload.monthlyFocus,
  };
  if (payload.rationale) subset.rationale = payload.rationale;
  if (payload.positiveHighlight) subset.positiveHighlight = payload.positiveHighlight;
  if (payload.actionToday) subset.actionToday = payload.actionToday;
  if (payload.dynamicsSummary) subset.dynamicsSummary = payload.dynamicsSummary;
  if (payload.vsPreviousPeriod?.length) subset.vsPreviousPeriod = payload.vsPreviousPeriod;
  if (payload.metricLinks?.length) subset.metricLinks = payload.metricLinks;
  if (payload.helpfulHabits?.length) subset.helpfulHabits = payload.helpfulHabits;
  return subset;
}

export function buildHealthyPhrasingPrompt(payload) {
  return `
Ты редактируешь формулировки wellness-insight для мобильного приложения.

Твоя задача:
1. Перепиши только стиль текста, не меняй смысл, факты, тон и приоритеты.
2. Не добавляй новые рекомендации, новые метрики, новые выводы или медицинские советы.
3. Нельзя упоминать: врачей, диагнозы, лекарства, препараты, алкоголь, курение, никотин, наркотики, секс.
4. Пиши кратко, мягко, поддерживающе, нейтрально и на русском языке.
5. Верни ТОЛЬКО один валидный JSON-объект: первый символ ответа «{», последний «}». Без markdown и без блоков кода, без пояснений до или после.
6. Для массивов сохрани то же количество элементов, что во входных данных.
7. Если поле отсутствует во входных данных или равно null, не добавляй его в ответ.

Исходный payload:
${JSON.stringify(buildPayloadSubsetForPhrasing(payload), null, 2)}

Верни JSON только с текстовыми полями, которые были во входных данных.
`.trim();
}

async function requestGeminiPhrasing(payload) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      payload,
      engineVersion: BASE_ENGINE_VERSION,
      modelUsed: null,
      fallbackReason: 'llm_not_configured',
      blockedTopics: [],
    };
  }

  const modelName = getModelName();
  const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${modelName}:generateContent?key=${apiKey}`;
  const userPrompt = buildHealthyPhrasingPrompt(payload);

  const response = await axios.post(
    url,
    {
      contents: [
        {
          parts: [{
            text: `Отвечай только валидным JSON-объектом, без markdown и без текста вокруг.\n\n${userPrompt}`,
          }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );

  const rawContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawContent) {
    throw new Error('Empty response from Gemini phrasing');
  }

  const parsed = phrasedInsightSchema.parse(extractPhrasingJsonObject(rawContent));
  const mergedPayload = mergePhrasedInsightPayload(payload, parsed);
  const safety = validateInsightPayload(mergedPayload);

  if (!safety.ok) {
    return {
      ok: false,
      payload,
      engineVersion: BASE_ENGINE_VERSION,
      modelUsed: modelName,
      fallbackReason: 'llm_blocked_topics',
      blockedTopics: safety.blockedTopics,
    };
  }

  return {
    ok: true,
    payload: mergedPayload,
    engineVersion: PHRASING_ENGINE_VERSION,
    modelUsed: modelName,
    fallbackReason: null,
    blockedTopics: [],
  };
}

class HealthyLlmPhrasingService {
  static async phraseInsightPayload(payload) {
    if (!isPhrasingEnabled()) {
      return {
        ok: false,
        payload,
        engineVersion: BASE_ENGINE_VERSION,
        modelUsed: null,
        fallbackReason: 'llm_disabled',
        blockedTopics: [],
      };
    }

    try {
      return await requestGeminiPhrasing(payload);
    } catch (error) {
      const modelName = getModelName();
      if (error?.response?.status === 404) {
        logGeminiModelNotFound(modelName, error?.response?.data);
      } else {
        logger.warn('Healthy LLM phrasing fallback activated', {
          message: error?.message,
          response: error?.response?.data,
        });
      }

      return {
        ok: false,
        payload,
        engineVersion: BASE_ENGINE_VERSION,
        modelUsed: modelName,
        fallbackReason: 'llm_request_failed',
        blockedTopics: [],
      };
    }
  }
}

export { BASE_ENGINE_VERSION, PHRASING_ENGINE_VERSION };
export default HealthyLlmPhrasingService;
