import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

const FCMToken = sequelize.define('FCMToken', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    platform: {
        type: DataTypes.ENUM('android', 'ios', 'web'),
        allowNull: false,
        defaultValue: 'android'
    },
    device_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    last_used: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'fcm_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['token']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['platform']
        },
        {
            fields: ['is_active']
        }
    ]
});

export default FCMToken;
