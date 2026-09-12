import logger from '../../utils/winston/logger.js';
import HealthyRecommendationService from './healthy-recommendation.service.js';

class HealthyBootstrapService {
  static async initialize() {
    await HealthyRecommendationService.seedApprovedContent();
    logger.info('Healthy content bank initialized');
  }
}

export default HealthyBootstrapService;

