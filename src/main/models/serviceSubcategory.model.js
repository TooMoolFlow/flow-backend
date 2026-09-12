import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const ServiceSubcategory = sequelize.define('ServiceSubcategory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'service_categories', key: 'id' },
    },
    office_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'offices', key: 'id' },
    },
}, {
    tableName: 'service_subcategories',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['office_id', 'category_id', 'name'] },
    ],
});

ServiceSubcategory.associate = function(models) {
    ServiceSubcategory.belongsTo(models.ServiceCategory, {
        foreignKey: 'category_id',
        as: 'category',
    });
    ServiceSubcategory.belongsTo(models.Office, {
        foreignKey: 'office_id',
        as: 'office',
    });
};
