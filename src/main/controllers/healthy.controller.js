import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import {
  toHealthyInsightDto,
  toHealthyProfileDto,
  toHealthySyncResultDto,
} from '../dto/healthy.dto.js';
import HealthyProfileService from '../services/healthy/healthy-profile.service.js';
import HealthySyncService from '../services/healthy/healthy-sync.service.js';
import HealthyInsightEngineService from '../services/healthy/healthy-insight-engine.service.js';

class HealthyController {
  static getProfile = asyncHandler(async (req, res) => {
    const profile = await HealthyProfileService.getOrCreateProfile(req.user.id);
    res.json({ ok: true, data: toHealthyProfileDto(profile) });
  });

  static patchProfile = asyncHandler(async (req, res) => {
    const profile = await HealthyProfileService.updateProfile(req.user.id, req.body);
    res.json({ ok: true, data: toHealthyProfileDto(profile) });
  });

  static sync = asyncHandler(async (req, res) => {
    const result = await HealthySyncService.sync(req.user.id, req.body);
    res.status(200).json({ ok: true, data: toHealthySyncResultDto(result) });
  });

  static getInsights = asyncHandler(async (req, res) => {
    const { period } = req.validated?.query ?? req.query;
    const result = await HealthyInsightEngineService.getLatestForUser(req.user.id, period);
    res.json({ ok: true, data: toHealthyInsightDto(result) });
  });

  static regenerate = asyncHandler(async (req, res) => {
    const { period } = req.body;
    const result = await HealthyInsightEngineService.getLatestForUser(req.user.id, period);
    res.json({ ok: true, data: toHealthyInsightDto(result) });
  });
}

export default HealthyController;

