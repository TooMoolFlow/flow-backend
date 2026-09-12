import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const MeetingRoomPhoto = sequelize.define('MeetingRoomPhoto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    meeting_room_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'meeting_rooms', key: 'id' },
        onDelete: 'CASCADE',
    },
    photo_url: {
        type: DataTypes.STRING(1024),
        allowNull: false,
    },
    sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    tableName: 'meeting_room_photos',
    timestamps: true,
    underscored: true,
});
