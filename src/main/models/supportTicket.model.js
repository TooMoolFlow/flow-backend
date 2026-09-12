import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const SupportTicket = sequelize.define('SupportTicket', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
    },
    assigned_admin_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL'
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'open',
        validate: { isIn: [['open', 'in_progress', 'closed']] }
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
    tableName: 'support_tickets',
    timestamps: false
});
