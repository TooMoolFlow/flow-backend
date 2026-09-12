import { BadRequestError } from '../../errors/errors.js';
import { HealthyMetricDaily } from '../../models/init.model.js';
import HealthyProfileService from './healthy-profile.service.js';

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateCompletenessScore(metric) {
  const keys = [
    metric.sleep_minutes,
    metric.sleep_rating,
    metric.water_ml,
    metric.steps_count,
    metric.mood_value,
    metric.energy_level,
    metric.stress_level,
  ];
  const present = keys.filter((value) => value !== null && value !== undefined && value !== '').length;
  return Number(((present / keys.length) * 100).toFixed(2));
}

function normalizeDailyMetric(date, item) {
  return {
    date,
    sleep_minutes: normalizeNumber(item.sleep_minutes),
    sleep_rating: item.sleep_rating ?? null,
    water_ml: normalizeNumber(item.water_ml),
    water_goal_ml: normalizeNumber(item.water_goal_ml),
    steps_count: normalizeNumber(item.steps_count),
    mood_value: normalizeNumber(item.mood_value),
    energy_level: item.energy_level ?? null,
    stress_level: item.stress_level ?? null,
    data_sources: item.data_sources ?? {},
  };
}

class HealthySyncService {
  static async sync(userId, payload) {
    if (!payload || !Array.isArray(payload.metrics) || payload.metrics.length === 0) {
      throw new BadRequestError('Передайте массив metrics для синка healthy-данных.');
    }

    if (payload.profile) {
      await HealthyProfileService.updateProfile(userId, payload.profile);
    } else {
      await HealthyProfileService.getOrCreateProfile(userId);
    }

    const syncedDates = [];
    for (const metric of payload.metrics) {
      if (!metric?.date) {
        throw new BadRequestError('Каждая запись metrics должна содержать date.');
      }

      const normalized = normalizeDailyMetric(metric.date, metric);
      normalized.completeness_score = calculateCompletenessScore(normalized);

      const [row] = await HealthyMetricDaily.findOrCreate({
        where: { user_id: userId, date: normalized.date },
        defaults: {
          user_id: userId,
          ...normalized,
        },
      });

      await row.update({
        sleep_minutes: normalized.sleep_minutes,
        sleep_rating: normalized.sleep_rating,
        water_ml: normalized.water_ml,
        water_goal_ml: normalized.water_goal_ml,
        steps_count: normalized.steps_count,
        mood_value: normalized.mood_value,
        energy_level: normalized.energy_level,
        stress_level: normalized.stress_level,
        data_sources: normalized.data_sources,
        completeness_score: normalized.completeness_score,
      });

      syncedDates.push(normalized.date);
    }

    return {
      ok: true,
      synced_dates: syncedDates,
      profile_updated: Boolean(payload.profile),
    };
  }
}

export default HealthySyncService;

