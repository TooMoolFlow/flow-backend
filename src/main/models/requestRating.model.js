import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';
export const RequestRating = sequelize.define('RequestRating', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0, max: 5 }
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    request_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'requests',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    rated_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    rated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'request_ratings', timestamps: false });
