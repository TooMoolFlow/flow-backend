import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const HealthyInsightSnapshot = sequelize.define('HealthyInsightSnapshot', {
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
  period_type: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },
  period_start: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  period_end: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status_label: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  status_tone: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  weak_points_json: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  recommendation_ids_json: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  support_message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  low_data_flag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  engine_version: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  generated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'healthy_insight_snapshots',
  timestamps: true,
  underscored: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  indexes: [
    { unique: true, fields: ['user_id', 'period_type', 'period_start', 'period_end'] },
    { fields: ['user_id', 'period_type'] },
  ],
});

