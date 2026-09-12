import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';
import { ServiceCategory } from './serviceCategory.model.js';

export const RegistrationRequest = sequelize.define('RegistrationRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    validate: {
      is: /^\+7 \d{3} \d{3} \d{2} \d{2}$/
    }
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  office_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'offices',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  service_category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'service_categories',
      key: 'id'
    }
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
  /**
   * Произвольное название компании, если пользователь выбрал «Другое» при регистрации.
   * Используется только до approve; после approve администратор либо привязывает к существующей компании,
   * либо создаёт новую и сохраняет её id в users.company_id.
   */
  company_other_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'registration_requests',
  timestamps: false
});

// Ассоциации
RegistrationRequest.belongsTo(ServiceCategory, {
  foreignKey: 'service_category_id',
  as: 'service_category'
});

export default RegistrationRequest;
