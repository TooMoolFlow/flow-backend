import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const SupportTicketMessage = sequelize.define('SupportTicketMessage', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'support_tickets', key: 'id' },
        onDelete: 'CASCADE'
    },
    sender: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [['user', 'admin']] }
    },
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
    },
    message: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    tableName: 'support_ticket_messages',
    timestamps: false
});
