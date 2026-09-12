import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const HealthyMetricDaily = sequelize.define('HealthyMetricDaily', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  sleep_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  sleep_rating: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  water_ml: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  water_goal_ml: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  steps_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  mood_value: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  energy_level: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  stress_level: {
    type: DataTypes.STRING(16),
    allowNull: true,
  },
  data_sources: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  completeness_score: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'healthy_metric_daily',
  timestamps: true,
  underscored: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  indexes: [
    { unique: true, fields: ['user_id', 'date'] },
    { fields: ['user_id'] },
    { fields: ['date'] },
  ],
});

