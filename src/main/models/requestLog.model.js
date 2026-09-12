import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const RequestLog = sequelize.define('RequestLog', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    request_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: {
            model: 'request_groups',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    user_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    action_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [[
                'created',
                'group_created',
                'sub_request_created',
                'updated',
                'status_changed',
                'assigned',
                'unassigned',
                'started',
                'completed',
                'rejected',
                'commented',
                'photo_added',
                'long_term_toggled',
                'returned',
                'priority_changed',
                'category_changed',
                'location_changed',
                'deleted'
            ]]
        }
    },
    action_description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    old_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Предыдущие значения измененных полей'
    },
    new_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Новые значения измененных полей'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP адрес пользователя'
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User-Agent браузера'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'request_logs',
    timestamps: false,
    indexes: [
        {
            fields: ['request_id']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['action_type']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['request_id', 'created_at']
        }
    ]
});
