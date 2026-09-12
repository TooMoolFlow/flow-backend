import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const RatingLog = sequelize.define('RatingLog', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    rating_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['client_rating', 'request_rating']]
        }
    },
    rating_id: { 
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
    action_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['created', 'updated', 'deleted']]
        }
    },
    action_description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    old_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Предыдущие значения измененных полей'
    },
    new_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Новые значения измененных полей'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'rating_logs',
    timestamps: false,
    indexes: [
        {
            fields: ['rating_type']
        },
        {
            fields: ['rating_id']
        },
        {
            fields: ['user_id']
        },
        {
            fields: ['action_type']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['rating_type', 'rating_id']
        }
    ]
});
