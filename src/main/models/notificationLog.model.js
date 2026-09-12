import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const NotificationLog = sequelize.define('NotificationLog', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    notification_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false
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
    notification_type: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    delivery_method: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['email', 'push', 'in_app']]
        }
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['sent', 'delivered', 'failed', 'pending']]
        }
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    recipient_email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    fcm_token: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'notification_logs',
    timestamps: false,
    indexes: [
        {
            fields: ['notification_id']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['delivery_method']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['status', 'created_at']
        }
    ]
});
