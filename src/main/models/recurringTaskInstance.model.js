import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';
import { RequestGroup } from './requestGroup.model.js';
import { User } from './user.model.js';

export const RecurringTaskInstance = sequelize.define('RecurringTaskInstance', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    request_group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'request_groups', key: 'id' }
    },
    due_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    completed_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    completed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'completed', 'overdue', 'skipped']]
        }
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    },
    updated_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    }
}, {
    tableName: 'recurring_task_instances',
    timestamps: false
});

// Определяем связи
RecurringTaskInstance.belongsTo(RequestGroup, {
    foreignKey: 'request_group_id',
    as: 'requestGroup'
});

RecurringTaskInstance.belongsTo(User, {
    foreignKey: 'completed_by',
    as: 'completedByUser'
});

export default RecurringTaskInstance;
