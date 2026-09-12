import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const YandexSmartHomeToken = sequelize.define('YandexSmartHomeToken', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    access_token: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    refresh_token: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'yandex_smart_home_tokens',
    timestamps: false
});

