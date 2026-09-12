import { HealthyProfile } from '../../models/init.model.js';

const DEFAULT_PROFILE = {
  sleep_goal_minutes: 480,
  steps_goal: null,
  weight_kg: null,
  height_cm: null,
  health_data_consent: false,
  apple_health_enabled: false,
  sleep_notifications_enabled: true,
  steps_notifications_enabled: true,
  no_activity_interval_hours: 2,
};

class HealthyProfileService {
  static async getOrCreateProfile(userId) {
    const [profile] = await HealthyProfile.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        ...DEFAULT_PROFILE,
      },
    });
    return profile;
  }

  static async updateProfile(userId, patch) {
    const profile = await this.getOrCreateProfile(userId);
    await profile.update({
      sleep_goal_minutes: patch.sleep_goal_minutes ?? profile.sleep_goal_minutes,
      steps_goal: patch.steps_goal ?? profile.steps_goal,
      weight_kg: patch.weight_kg ?? profile.weight_kg,
      height_cm: patch.height_cm ?? profile.height_cm,
      health_data_consent: patch.health_data_consent ?? profile.health_data_consent,
      apple_health_enabled: patch.apple_health_enabled ?? profile.apple_health_enabled,
      sleep_notifications_enabled: patch.sleep_notifications_enabled ?? profile.sleep_notifications_enabled,
      steps_notifications_enabled: patch.steps_notifications_enabled ?? profile.steps_notifications_enabled,
      no_activity_interval_hours: patch.no_activity_interval_hours ?? profile.no_activity_interval_hours,
    });
    return profile;
  }
}

export default HealthyProfileService;

