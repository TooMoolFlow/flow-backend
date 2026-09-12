import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const News = sequelize.define('News', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    image_url: {
        type: DataTypes.STRING(1024),
        allowNull: true,
    },
    status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'hidden', 'archived', 'scheduled']],
        },
    },
    notification_type: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'none',
        validate: {
            isIn: [['none', 'push_sound', 'push_silent']],
        },
    },
    published_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
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
}, {
    tableName: 'news',
    timestamps: false,
});

