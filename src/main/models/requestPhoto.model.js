import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const RequestPhoto = sequelize.define('RequestPhoto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    request_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'request_groups',
            key: 'id'
        }
    },
    photo_url: { type: DataTypes.STRING(255), allowNull: false },
    type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['before', 'after']]
        }
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
}, {
    tableName: 'request_photos',
    timestamps: false
});
