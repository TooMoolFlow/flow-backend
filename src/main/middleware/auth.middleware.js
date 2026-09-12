import logger from '../utils/winston/logger.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { ForbiddenError, UnauthorizedError } from '../errors/errors.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret';

/** Если передан валидный Bearer — заполняет req.user; иначе req.user = null (без ошибки). */
const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        logger.warn({ message: 'Нет токена авторизации.', endpoint: req.originalUrl });
        return next(new UnauthorizedError('Нет токена авторизации.'));
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logger.warn({ message: 'Неверный токен.', endpoint: req.originalUrl, error: err.message });
            return next(new UnauthorizedError('Неверный токен.'));
        }
        req.user = user;
        next();
    });
};

/** Разрешить доступ только указанным ролям (иначе ForbiddenError). */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (!allowedRoles.includes(userRole)) {
            logger.warn({ message: 'Доступ запрещён для роли', userRole, allowedRoles, endpoint: req.originalUrl });
            return next(new ForbiddenError('Доступ запрещён.'));
        }
        next();
    };
};

/** Запретить доступ указанным ролям (например, только клиенты создают тикет). */
const forbidRoles = (...forbiddenRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        if (forbiddenRoles.includes(userRole)) {
            logger.warn({ message: 'Действие запрещено для роли', userRole, endpoint: req.originalUrl });
            return next(new ForbiddenError('Действие запрещено для вашей роли.'));
        }
        next();
    };
};



export { authenticateToken, authorizeRoles, forbidRoles, optionalAuthenticateToken };
