import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const RequestGroup = sequelize.define('RequestGroup', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    client_id: { type: DataTypes.INTEGER, references: { model: 'users', key: 'id' } },
    office_id: { type: DataTypes.INTEGER, references: { model: 'offices', key: 'id' } },
    location: { type: DataTypes.STRING(255), allowNull: false },
    location_detail: DataTypes.STRING(255),
    date_submitted: { type: DataTypes.DATE },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['in_progress', 'execution', 'completed', 'rejected',
                'awaiting_assignment', 'awaiting_sla', 'assigned']]
        },
        defaultValue: 'in_progress'
    },
    request_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['normal', 'urgent', 'planned', 'recurring']]
        },
        defaultValue: 'normal'
    },
    rejection_reason: DataTypes.TEXT,
    planned_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    created_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    },
    // Поля для повторяющихся задач (используются только при request_type = 'recurring')
    recurrence_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [['daily', 'weekly', 'monthly', 'yearly']]
        }
    },
    recurrence_interval: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1
    },
    next_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    last_completed_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    recurring_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
            isIn: [['active', 'paused', 'completed']]
        },
        defaultValue: 'active'
    }
}, {
    tableName: 'request_groups',
    timestamps: false
});
