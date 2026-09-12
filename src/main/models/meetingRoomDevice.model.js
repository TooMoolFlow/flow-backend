import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const MeetingRoomDevice = sequelize.define('MeetingRoomDevice', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
    device_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    device_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    device_type: {
        type: DataTypes.STRING(100),
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
    tableName: 'meeting_room_devices',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['meeting_room_id', 'device_id']
        }
    ]
});

