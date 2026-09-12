import { Op } from 'sequelize';
import logger from '../../utils/winston/logger.js';
import { HealthyGenerationLog } from '../../models/init.model.js';

const DEFAULT_RETENTION_DAYS = 30;

class HealthyOpsService {
  static async cleanupGenerationLogs() {
    const retentionDays = Number(process.env.HEALTHY_LOG_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - retentionDays);

    const deleted = await HealthyGenerationLog.destroy({
      where: {
        created_at: {
          [Op.lt]: threshold,
        },
      },
    });

    if (deleted > 0) {
      logger.info(`Healthy generation logs cleanup: deleted ${deleted} rows`);
    }

    return { deleted };
  }
}

export default HealthyOpsService;

