import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    full_name: { type: DataTypes.STRING(255), allowNull: false },
    office_id: {
        type: DataTypes.INTEGER,
        references: {
            model: 'offices',
            key: 'id'
        }
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['client', 'admin-worker', 'department-head', 'executor', 'manager']]
        }
    },
    email_notifications: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    security_notifications: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    marketing_notifications: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    service_category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'service_categories',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    company_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'companies',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        validate: {
            is: /^\+7 \d{3} \d{3} \d{2} \d{2}$/
        }
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    email_verification_code: {
        type: DataTypes.STRING(6),
        allowNull: true
    },
    email_verification_code_expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: false
});
