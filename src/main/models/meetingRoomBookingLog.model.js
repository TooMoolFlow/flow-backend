import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const MeetingRoomBookingLog = sequelize.define('MeetingRoomBookingLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'meeting_room_bookings',
      key: 'id'
    }
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'meeting_rooms',
      key: 'id'
    }
  },
  office_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'offices',
      key: 'id'
    }
  },
  actor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  actor_role: {
    type: DataTypes.STRING,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  from_status: {
    type: DataTypes.STRING,
    allowNull: true
  },
  to_status: {
    type: DataTypes.STRING,
    allowNull: true
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'meeting_room_booking_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true
});

