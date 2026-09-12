import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const Office = sequelize.define('Office', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    address: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    city: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    block: {
        type: DataTypes.STRING(255),
        allowNull: true, // Разрешаем null, если блок не указан
    },
    floor: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    photo: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    lat: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
    },
    lon: {
        type: DataTypes.DECIMAL(9, 6),
        allowNull: true,
    },
    working_hours_start: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: '08:00:00'
    },
    working_hours_end: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: '18:00:00'
    },
    auto_track_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'offices',
    timestamps: false
});
