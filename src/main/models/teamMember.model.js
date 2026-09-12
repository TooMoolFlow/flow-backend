import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';

export const TeamMember = sequelize.define(
    'TeamMember',
    {
        team_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'teams', key: 'id' },
            onDelete: 'CASCADE',
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
        },
    },
    {
        tableName: 'team_members',
        timestamps: false,
    }
);

export default TeamMember;
