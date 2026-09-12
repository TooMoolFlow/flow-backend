import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';
export const Plan = sequelize.define('Plan', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    description: { type: DataTypes.TEXT },
    location_detail: { type: DataTypes.STRING(255) },
    date_submitted: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    start_date: { type: DataTypes.DATE },
    end_date: { type: DataTypes.DATE }
}, { tableName: 'plans', timestamps: false });