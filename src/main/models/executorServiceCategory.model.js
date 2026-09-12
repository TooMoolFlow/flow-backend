import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const ExecutorServiceCategory = sequelize.define(
  'ExecutorServiceCategory',
  {
    executor_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: 'executors', key: 'id' },
      onDelete: 'CASCADE',
    },
    category_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: 'service_categories', key: 'id' },
      onDelete: 'CASCADE',
    },
  },
  {
    tableName: 'executor_service_categories',
    timestamps: false,
  }
);
