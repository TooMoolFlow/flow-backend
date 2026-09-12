import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const NewsView = sequelize.define(
    'NewsView',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        news_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'news', key: 'id' },
            onDelete: 'CASCADE',
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
        viewed_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: 'news_views',
        timestamps: false,
        indexes: [{ unique: true, fields: ['news_id', 'user_id'] }],
    },
);
