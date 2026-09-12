import { Sequelize } from 'sequelize';
import dotenv from "dotenv";

dotenv.config();

export function createSequelize({ dbName, user, password, host, port, ssl }) {
    return new Sequelize(dbName, user, password, {
        host,
        port,
        dialect: 'postgres',
        timezone: '+00:00', // храним и читаем только UTC; отображение по таймзоне — на фронте (Asia/Almaty)
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: false,
            freezeTableName: true
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        dialectOptions: {
            ssl: ssl || (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? {
                require: true,
                rejectUnauthorized: false
            } : false)
        }
    });
}
