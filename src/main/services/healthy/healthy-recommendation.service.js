import { HealthyRecommendationContent } from '../../models/init.model.js';
import { getHealthyContentBank } from './healthy-content-bank.service.js';
import { validateRecommendationRecord } from './healthy-safety.service.js';

class HealthyRecommendationService {
  static async seedApprovedContent() {
    const bank = getHealthyContentBank();
    for (const item of bank) {
      const validation = validateRecommendationRecord(item);
      const status = validation.ok ? item.status : 'blocked';
      const safetyFlags = validation.ok
        ? item.safetyFlags
        : [...new Set([...(item.safetyFlags ?? []), 'blocked', ...validation.blockedTopics])];

      await HealthyRecommendationContent.upsert({
        content_key: item.contentKey,
        metric_tags: item.metricTags,
        period_tags: item.periodTags,
        tone: item.tone,
        text: item.text,
        source_ref: item.sourceRef,
        status,
        safety_flags: safetyFlags,
        locale: item.locale,
      });
    }
  }

  static async selectRecommendations({ metricTags, period, limit = 3 }) {
    const all = await HealthyRecommendationContent.findAll({
      where: {
        status: 'approved',
        locale: 'ru',
      },
      order: [['id', 'ASC']],
    });

    const wanted = new Set(metricTags);
    const matching = all.filter((row) => {
      const rowMetricTags = Array.isArray(row.metric_tags) ? row.metric_tags : [];
      const rowPeriodTags = Array.isArray(row.period_tags) ? row.period_tags : [];
      const metricMatch = rowMetricTags.some((tag) => wanted.has(tag));
      const periodMatch = rowPeriodTags.includes(period);
      return metricMatch && periodMatch;
    });

    if (matching.length >= limit) {
      return matching.slice(0, limit);
    }

    const fallback = all.filter((row) => {
      const rowMetricTags = Array.isArray(row.metric_tags) ? row.metric_tags : [];
      return rowMetricTags.includes('recovery') || rowMetricTags.includes('positive_support') || rowMetricTags.includes('low_data');
    });

    return [...matching, ...fallback].slice(0, limit);
  }
}

export default HealthyRecommendationService;

