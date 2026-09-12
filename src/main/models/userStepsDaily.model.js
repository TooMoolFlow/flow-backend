import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const UserStepsDaily = sequelize.define('UserStepsDaily', {
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
    steps_today: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    goal_steps: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    no_activity_interval_hours: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 2,
    },
    steps_notifications_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    last_steps_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    last_steps_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    fifty_sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    almost_goal_sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    no_activity_count: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
    },
    no_activity_last_sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'user_steps_daily',
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
