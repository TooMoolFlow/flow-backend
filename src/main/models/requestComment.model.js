import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const RequestComment = sequelize.define('RequestComment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    request_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'requests', key: 'id' }
    },
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    comment: { type: DataTypes.TEXT, allowNull: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'request_comments',
    timestamps: false
});
