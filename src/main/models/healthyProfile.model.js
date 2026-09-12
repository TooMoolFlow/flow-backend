import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const HealthyProfile = sequelize.define('HealthyProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'users', key: 'id' },
  },
  sleep_goal_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 480,
  },
  steps_goal: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  weight_kg: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  height_cm: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  health_data_consent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  apple_health_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  sleep_notifications_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  steps_notifications_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  no_activity_interval_hours: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 2,
  },
}, {
  tableName: 'healthy_profiles',
  timestamps: true,
  underscored: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
});

