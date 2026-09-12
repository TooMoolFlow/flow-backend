import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const HealthyRecommendationContent = sequelize.define('HealthyRecommendationContent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  content_key: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  metric_tags: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  period_tags: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  tone: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'neutral',
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  source_ref: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'approved',
  },
  safety_flags: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  locale: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'ru',
  },
}, {
  tableName: 'healthy_recommendation_content',
  timestamps: true,
  underscored: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
});

