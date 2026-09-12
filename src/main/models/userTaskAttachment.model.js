import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const UserTaskAttachment = sequelize.define(
  'UserTaskAttachment',
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
    uploaded_by_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id', onDelete: 'CASCADE' },
    },
    file_url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mime_type: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    file_kind: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['image', 'video', 'document']],
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'user_task_attachments',
    timestamps: false,
  }
);

export default UserTaskAttachment;

