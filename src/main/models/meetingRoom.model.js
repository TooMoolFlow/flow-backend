import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const MeetingRoom = sequelize.define('MeetingRoom', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    floor: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    capacity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    room_type: {
        type: DataTypes.ENUM('meeting', 'cabinet'),
        allowNull: false,
        defaultValue: 'meeting',
    },
    equipment: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: []
    },
    status: {
        type: DataTypes.ENUM('available', 'booked'),
        allowNull: false,
        defaultValue: 'available'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    office_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'offices',
            key: 'id'
        }
    }
}, {
    tableName: 'meeting_rooms',
    timestamps: true,
    underscored: true
});

