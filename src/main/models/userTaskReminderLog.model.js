import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const UserTaskReminderLog = sequelize.define(
  'UserTaskReminderLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_task_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'user_tasks', key: 'id', onDelete: 'CASCADE' },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id', onDelete: 'CASCADE' },
    },
    remind_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'sent',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'user_task_reminder_logs',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['user_task_id', 'user_id', 'remind_at'] },
      { fields: ['user_id'] },
      { fields: ['sent_at'] },
    ],
  }
);

export default UserTaskReminderLog;
