import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.config.js";

const ClientRating = sequelize.define('ClientRating', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    rated_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    request_group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'request_groups',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 5
        }
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'client_ratings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default ClientRating;
