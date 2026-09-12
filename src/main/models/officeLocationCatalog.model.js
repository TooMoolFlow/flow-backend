import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const OfficeLocationCatalog = sequelize.define(
  'OfficeLocationCatalog',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    office_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'offices', key: 'id' },
    },
    block: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    floor_zone: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    room: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: 'office_location_catalog',
    timestamps: false,
    underscored: true,
  },
);
