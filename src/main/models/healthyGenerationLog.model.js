import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const HealthyGenerationLog = sequelize.define('HealthyGenerationLog', {
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
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  model_used: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  engine_version: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  fallback_reason: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  blocked_topics: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  safety_decisions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  latency_ms: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'healthy_generation_logs',
  timestamps: false,
});

