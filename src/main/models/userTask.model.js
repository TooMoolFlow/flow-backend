import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const UserTask = sequelize.define('UserTask', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    creator_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id', onDelete: 'CASCADE' },
    },
    title: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
    completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    completed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id', onDelete: 'SET NULL' },
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    inbox: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    deadline_from: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    deadline_to: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    deadline_time: {
        type: DataTypes.STRING(5),
        allowNull: true,
    },
    remind_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
    },
    reminders_disabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    remind_before_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
    },
    recurrence_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'none',
    },
    recurrence_interval: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    recurrence_custom_unit: {
        type: DataTypes.STRING(16),
        allowNull: true,
    },
    recurrence_weekdays: {
        type: DataTypes.JSON,
        allowNull: true,
    },
    team_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onDelete: 'SET NULL',
    },
    executor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'user_tasks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

export default UserTask;
