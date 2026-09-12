import { z } from 'zod';
import { BadRequestError } from '../errors/errors.js';

export const HEALTHY_API_VERSION = 'healthy.v1';

const nullableNumber = z.number().finite().nullable();
const nullableBoolean = z.boolean().nullable().optional();

export const healthyInsightPeriodSchema = z.enum(['day', 'week', 'month']);
export const healthySleepRatingSchema = z.enum(['poor', 'ok', 'good']).nullable();
export const healthyEnergyLevelSchema = z.enum(['low', 'medium', 'high']).nullable();
export const healthyStressLevelSchema = z.enum(['low', 'medium', 'high']).nullable();
export const healthyStatusToneSchema = z.enum(['positive', 'neutral', 'attention']);
export const healthyDynamicsLabelSchema = z.enum(['better', 'worse', 'stable']);

export const healthyWeakPointSchema = z.object({
  id: z.enum(['sleep', 'water', 'steps', 'mood', 'energy', 'stress']),
  label: z.string().min(1),
});

export const healthyProfilePatchSchema = z.object({
  sleep_goal_minutes: z.number().int().min(60).max(24 * 60).optional(),
  steps_goal: z.number().int().min(0).max(100000).nullable().optional(),
  weight_kg: z.number().min(0).max(1000).nullable().optional(),
  height_cm: z.number().min(0).max(300).nullable().optional(),
  health_data_consent: z.boolean().optional(),
  apple_health_enabled: z.boolean().optional(),
  sleep_notifications_enabled: z.boolean().optional(),
  steps_notifications_enabled: z.boolean().optional(),
  no_activity_interval_hours: z.number().int().min(1).max(12).optional(),
});
// Не strict: старые клиенты могли слать удалённые поля (напр. timezone) — они отбрасываются без 400.

export const healthyMetricDtoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sleep_minutes: nullableNumber.optional(),
  sleep_rating: healthySleepRatingSchema.optional(),
  water_ml: nullableNumber.optional(),
  water_goal_ml: nullableNumber.optional(),
  steps_count: nullableNumber.optional(),
  mood_value: nullableNumber.optional(),
  energy_level: healthyEnergyLevelSchema.optional(),
  stress_level: healthyStressLevelSchema.optional(),
  data_sources: z.record(z.string(), z.boolean()).default({}),
}).strict();

export const healthySyncRequestSchema = z.object({
  version: z.literal(HEALTHY_API_VERSION).optional().default(HEALTHY_API_VERSION),
  profile: healthyProfilePatchSchema.optional(),
  metrics: z.array(healthyMetricDtoSchema).min(1),
}).strict();

export const healthyRegenerateRequestSchema = z.object({
  version: z.literal(HEALTHY_API_VERSION).optional().default(HEALTHY_API_VERSION),
  period: healthyInsightPeriodSchema.optional().default('day'),
}).strict();

export const healthyInsightQuerySchema = z.object({
  period: healthyInsightPeriodSchema.optional().default('day'),
}).strict();

export const healthyProfileResponseSchema = z.object({
  version: z.literal(HEALTHY_API_VERSION),
  profile: z.object({
    user_id: z.number().int(),
    sleep_goal_minutes: z.number().int(),
    steps_goal: z.number().int().nullable(),
    weight_kg: z.union([z.number(), z.string()]).nullable(),
    height_cm: z.union([z.number(), z.string()]).nullable(),
    health_data_consent: z.boolean(),
    apple_health_enabled: z.boolean(),
    sleep_notifications_enabled: z.boolean(),
    steps_notifications_enabled: z.boolean(),
    no_activity_interval_hours: z.number().int(),
    created_at: z.union([z.date(), z.string()]).optional(),
    updated_at: z.union([z.date(), z.string()]).optional(),
  }),
});

export const healthySyncResponseSchema = z.object({
  version: z.literal(HEALTHY_API_VERSION),
  sync_result: z.object({
    ok: z.boolean(),
    synced_dates: z.array(z.string()),
    profile_updated: z.boolean(),
  }),
});

export const healthyInsightResponseSchema = z.object({
  version: z.literal(HEALTHY_API_VERSION),
  generated_at: z.union([z.date(), z.string()]).nullable().optional(),
  engine_version: z.string().optional(),
  period: healthyInsightPeriodSchema,
  lowData: z.boolean(),
  missingHints: z.array(z.string()),
  statusLabel: z.string(),
  statusTone: healthyStatusToneSchema,
  summary: z.string(),
  weakPoints: z.array(healthyWeakPointSchema),
  improved: z.array(z.string()),
  worsened: z.array(z.string()),
  recommendations: z.array(z.string()),
  supportMessage: z.string(),
  weeklyFocus: z.string().optional(),
  monthlyDynamics: z.string().optional(),
  strengths: z.array(z.string()),
  weaknessesNarrative: z.array(z.string()),
  patternsLine: z.string().optional(),
  monthlyFocus: z.string().optional(),
  dynamicsLabel: healthyDynamicsLabelSchema.optional(),
  dynamicsSummary: z.string().optional(),
  vsPreviousPeriod: z.array(z.string()).optional(),
  metricLinks: z.array(z.string()).optional(),
  helpfulHabits: z.array(z.string()).optional(),
  rationale: z.string().optional(),
  positiveHighlight: z.string().optional(),
  actionToday: z.string().optional(),
  metricRatios: z.object({
    cur: z.object({
      sleep: z.number().nullable().optional(),
      mood: z.number().nullable().optional(),
      steps: z.number().nullable().optional(),
      stressHigh: z.number().nullable().optional(),
    }),
    prev: z.object({
      sleep: z.number().nullable().optional(),
      mood: z.number().nullable().optional(),
      steps: z.number().nullable().optional(),
      stressHigh: z.number().nullable().optional(),
    }),
  }).optional(),
  sparklines: z.object({
    dates: z.array(z.string()),
    sleep: z.array(z.number().nullable()),
    mood: z.array(z.number().nullable()),
    steps: z.array(z.number().nullable()),
  }).nullable().optional(),
});

function parseOrThrow(schema, input, message) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestError(
      message || parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }
  return parsed.data;
}

export function parseHealthyProfilePatch(input) {
  return parseOrThrow(healthyProfilePatchSchema, input, 'Некорректный healthy profile patch.');
}

export function parseHealthySyncRequest(input) {
  return parseOrThrow(healthySyncRequestSchema, input, 'Некорректный healthy sync request.');
}

export function parseHealthyInsightQuery(input) {
  return parseOrThrow(healthyInsightQuerySchema, input, 'Некорректный healthy insights query.');
}

export function parseHealthyRegenerateRequest(input) {
  return parseOrThrow(healthyRegenerateRequestSchema, input, 'Некорректный healthy regenerate request.');
}

export function toHealthyProfileDto(profile) {
  return healthyProfileResponseSchema.parse({
    version: HEALTHY_API_VERSION,
    profile: {
      user_id: profile.user_id,
      sleep_goal_minutes: profile.sleep_goal_minutes,
      steps_goal: profile.steps_goal,
      weight_kg: profile.weight_kg,
      height_cm: profile.height_cm,
      health_data_consent: profile.health_data_consent,
      apple_health_enabled: profile.apple_health_enabled,
      sleep_notifications_enabled: profile.sleep_notifications_enabled,
      steps_notifications_enabled: profile.steps_notifications_enabled,
      no_activity_interval_hours: profile.no_activity_interval_hours,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    },
  });
}

export function toHealthySyncResultDto(syncResult) {
  return healthySyncResponseSchema.parse({
    version: HEALTHY_API_VERSION,
    sync_result: {
      ok: Boolean(syncResult.ok),
      synced_dates: Array.isArray(syncResult.synced_dates) ? syncResult.synced_dates : [],
      profile_updated: Boolean(syncResult.profile_updated),
    },
  });
}

export function toHealthyInsightDto(insight) {
  return healthyInsightResponseSchema.parse({
    version: HEALTHY_API_VERSION,
    generated_at: insight.generated_at ?? null,
    engine_version: insight.engine_version,
    period: insight.period,
    lowData: Boolean(insight.lowData),
    missingHints: Array.isArray(insight.missingHints) ? insight.missingHints : [],
    statusLabel: insight.statusLabel,
    statusTone: insight.statusTone,
    summary: insight.summary,
    weakPoints: Array.isArray(insight.weakPoints) ? insight.weakPoints : [],
    improved: Array.isArray(insight.improved) ? insight.improved : [],
    worsened: Array.isArray(insight.worsened) ? insight.worsened : [],
    recommendations: Array.isArray(insight.recommendations) ? insight.recommendations : [],
    supportMessage: insight.supportMessage,
    weeklyFocus: insight.weeklyFocus,
    monthlyDynamics: insight.monthlyDynamics,
    strengths: Array.isArray(insight.strengths) ? insight.strengths : [],
    weaknessesNarrative: Array.isArray(insight.weaknessesNarrative) ? insight.weaknessesNarrative : [],
    patternsLine: insight.patternsLine,
    monthlyFocus: insight.monthlyFocus,
    dynamicsLabel: insight.dynamicsLabel,
    dynamicsSummary: insight.dynamicsSummary,
    vsPreviousPeriod: Array.isArray(insight.vsPreviousPeriod) ? insight.vsPreviousPeriod : [],
    metricLinks: Array.isArray(insight.metricLinks) ? insight.metricLinks : [],
    helpfulHabits: Array.isArray(insight.helpfulHabits) ? insight.helpfulHabits : [],
    rationale: insight.rationale,
    positiveHighlight: insight.positiveHighlight,
    actionToday: insight.actionToday,
    metricRatios: insight.metricRatios,
    sparklines: insight.sparklines ?? null,
  });
}

