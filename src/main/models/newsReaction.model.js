import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const NewsReaction = sequelize.define(
    'NewsReaction',
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
        reaction: {
            type: DataTypes.STRING(16),
            allowNull: false,
            validate: {
                isIn: [['thumb', 'heart', 'eyes', 'fire']],
            },
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: 'news_reactions',
        timestamps: false,
        indexes: [{ unique: true, fields: ['news_id', 'user_id'] }],
    },
);
