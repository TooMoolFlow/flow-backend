import dotenv from 'dotenv';
import pg from 'pg';
import * as migrate from 'node-pg-migrate';
import { createSequelize } from './sequelize.config.js';
import logger from "../utils/winston/logger.js";

dotenv.config();

export const sequelize = createSequelize({
    dbName: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : false
});

// ❗ Removed previous extra pg.Pool
// We will use a single temporary client for migrations instead

export async function initDb() {
    let client;

    try {
        logger.info('Migration is running...');

        // Temporary client ONLY for migrations
        const clientConfig = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        };

        // SSL только если явно указано в переменных окружения
        if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
            clientConfig.ssl = { rejectUnauthorized: false };
        }

        client = new pg.Client(clientConfig);

        await client.connect();

        await migrate.runner({
            dbClient: client,  // <— using direct client avoids creating pools
            migrationsTable: 'schema_migrations',
            dir: 'src/main/migrations',
            direction: 'up',
            log: () => {},
            verbose: true,
            sqlFile: true,
        });

        logger.info('Migrations successfully.');
    } catch (error) {
        logger.error('Migration error:', error);
        process.exit(1);
    } finally {
        if (client) {
            await client.end(); // <— ALWAYS close
        }
    }
}