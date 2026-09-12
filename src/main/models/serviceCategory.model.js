import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const ServiceCategory = sequelize.define('ServiceCategory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    office_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'offices', key: 'id' },
    },
}, {
    tableName: 'service_categories',
    timestamps: false,
    indexes: [
        { unique: true, fields: ['office_id', 'name'] },
    ],
});

ServiceCategory.associate = function(models) {
    ServiceCategory.belongsTo(models.Office, {
        foreignKey: 'office_id',
        as: 'office',
    });
    ServiceCategory.hasMany(models.ServiceSubcategory, {
        foreignKey: 'category_id',
        as: 'subcategories',
    });
};
