import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const UserTaskAssignee = sequelize.define('UserTaskAssignee', {
    user_task_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'user_tasks', key: 'id', onDelete: 'CASCADE' },
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'users', key: 'id', onDelete: 'CASCADE' },
    },
}, {
    tableName: 'user_task_assignees',
    timestamps: false,
});

export default UserTaskAssignee;
