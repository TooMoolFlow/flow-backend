import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const Executor = sequelize.define('Executor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    department_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    specialty: { type: DataTypes.STRING(100), allowNull: false }
}, {
    tableName: 'executors',
    timestamps: false
});
