import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const Request = sequelize.define('Request', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    request_group_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: { model: 'request_groups', key: 'id' }
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: DataTypes.TEXT,
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['in_progress', 'execution', 'completed', 'rejected',
                'awaiting_assignment', 'awaiting_sla', 'assigned']]
        },
        defaultValue: 'in_progress'
    },
    category_id: { type: DataTypes.INTEGER, references: { model: 'service_categories', key: 'id' } },
    subcategory_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'service_subcategories', key: 'id' },
    },
    complexity: { type: DataTypes.STRING(50) },
    sla: DataTypes.STRING(50),
    plan_id: { type: DataTypes.INTEGER, references: { model: 'plans', key: 'id' } },
    actual_completion_date: DataTypes.DATE,
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
    comment: { type: DataTypes.STRING(255), allowNull: true },
    is_long_term: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    sub_request_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
    }
}, {
    tableName: 'requests',
    timestamps: false
});
