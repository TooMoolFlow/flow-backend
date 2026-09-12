import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const VerificationCode = sequelize.define('VerificationCode', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            is: /^\+7 \d{3} \d{3} \d{2} \d{2}$/
        }
    },
    code: {
        type: DataTypes.STRING(6),
        allowNull: false
    },
    purpose: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['registration', 'password_reset']]
        }
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    used: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    used_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'verification_codes',
    timestamps: false
});

