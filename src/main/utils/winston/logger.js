import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

winston.addColors({
    info: 'green',
    error: 'red',
    warn: 'yellow',
    debug: 'blue',
});

const logDirectory = process.env.LOG_DIR || 'logs';

const transport = new DailyRotateFile({
    filename: `${logDirectory}/%DATE%-combined.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '7d',
    level: 'info'
});

const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, response, body, ...meta }) => {
            const log = {
                timestamp,
                level,
                message,
                response,
                userId: meta.userId || null,
                endpoint: meta.endpoint || null,
                service: meta.service || 'backend',
                requestId: meta.requestId || null,
                body
            };
            return JSON.stringify(log);
        })
    ),
    transports: [
        transport,
        new winston.transports.Console({
            level: 'debug',
            format: consoleFormat
        })
    ]
});

export default logger;
