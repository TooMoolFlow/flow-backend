import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const ClientRoomSubscription = sequelize.define('ClientRoomSubscription', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    meeting_room_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'meeting_rooms',
            key: 'id'
        },
        onDelete: 'CASCADE'
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
    tableName: 'client_room_subscriptions',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['client_id', 'meeting_room_id']
        }
    ]
});
