import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const MEETING_ROOM_BOOKING_STATUSES = [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'auto_cancelled'
];

export const MeetingRoomBooking = sequelize.define('MeetingRoomBooking', {
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
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...MEETING_ROOM_BOOKING_STATUSES),
    allowNull: false,
    defaultValue: 'scheduled'
  },
  company_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reminder_sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  attendance_confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cancellation_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tables_remaining: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'meeting_room_bookings',
  timestamps: true,
  underscored: true
});

