import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const Company = sequelize.define(
  'Company',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    office_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'offices', key: 'id' },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'companies',
    timestamps: false,
    underscored: true,
  },
);

export default Company;
