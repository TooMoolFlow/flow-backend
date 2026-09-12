import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const RequestExecutor = sequelize.define('RequestExecutor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    request_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: { model: 'requests', key: 'id' }
    },
    executor_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        references: { model: 'executors', key: 'id' }
    },
    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'executor',
        validate: {
            isIn: [['executor', 'leader']]
        }
    }
}, {
    tableName: 'request_executors',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['request_id', 'executor_id']
        }
    ]
});
