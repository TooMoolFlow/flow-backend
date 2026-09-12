import admin from 'firebase-admin';
import logger from '../utils/winston/logger.js';
import { InternalError } from '../errors/errors.js';
import path from 'path';
import fs from 'fs';

let firebaseApp = null;

function parseJsonSafely(text, label) {
    try {
        return JSON.parse(text);
    } catch (e) {
        logger.error(`Failed to parse ${label}:`, e);
        return null;
    }
}

function readJsonFileSafely(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            return parseJsonSafely(raw, `JSON at ${filePath}`);
        }
        return null;
    } catch (e) {
        logger.error(`Error reading ${filePath}:`, e);
        return null;
    }
}

function resolveServiceAccount() {
    // 1) Base64 в .env (FIREBASE_SERVICE_ACCOUNT_BASE64) — приоритетный способ для Render / env-файла
    const base64Raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (base64Raw) {
        try {
            const decoded = Buffer.from(base64Raw, 'base64').toString('utf8');
            const obj = parseJsonSafely(decoded, 'FIREBASE_SERVICE_ACCOUNT_BASE64 env var');
            if (obj && obj.type === 'service_account' && obj.client_email) {
                logger.info('Using Firebase service account from FIREBASE_SERVICE_ACCOUNT_BASE64');
                return obj;
            }
            if (!obj) logger.warn('FIREBASE_SERVICE_ACCOUNT_BASE64 is set but decoded value is not valid JSON');
            else logger.warn('FIREBASE_SERVICE_ACCOUNT_BASE64 decoded JSON missing type/client_email');
        } catch (e) {
            logger.error('Failed to decode FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
        }
    } else {
        logger.info('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set (required on Render for iOS/Android push)');
    }

    // 2) Прямой JSON в переменной окружения
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (jsonEnv) {
        const obj = parseJsonSafely(jsonEnv, 'FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_JSON env var');
        if (obj) {
            logger.info('Using Firebase service account from env (FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_JSON)');
            return obj;
        }
    }

    // 3) Путь к файлу из переменных окружения
    const envPath =
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS; // распространённая практика для Google SDK

    if (envPath) {
        const obj = readJsonFileSafely(envPath);
        if (obj) {
            logger.info(`Using Firebase service account from file path in env (${envPath})`);
            return obj;
        } else {
            logger.warn(`Service account file declared in env not found or invalid: ${envPath}`);
        }
    }

    // 4) Дефолтный путь для Render Secret Files
    const renderSecretPath = '/etc/secrets/serviceAccountKey.json';
    const fromRender = readJsonFileSafely(renderSecretPath);
    if (fromRender) {
        logger.info(`Using Firebase service account from Render Secret File (${renderSecretPath})`);
        return fromRender;
    }

    // 5) Локальный файл (например для dev)
    const localPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const fromLocal = readJsonFileSafely(localPath);
    if (fromLocal) {
        logger.info(`Using Firebase service account from local file (${localPath})`);
        return fromLocal;
    }

    return null;
}

export const initializeFirebase = async () => {
    try {
        if (firebaseApp) {
            // уже инициализирован
            return firebaseApp;
        }

        // Вариант A: вытащить объект и проинициализировать через admin.credential.cert(...)
        const serviceAccount = resolveServiceAccount();

        if (serviceAccount) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            logger.info('Firebase Admin SDK initialized successfully (service account cert)');
            return firebaseApp;
        }

        // Вариант B: GOOGLE_APPLICATION_CREDENTIALS — путь к JSON файлу (не используем applicationDefault, т.к. на Render нет учёток)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            const fromPath = readJsonFileSafely(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            if (fromPath) {
                firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(fromPath),
                });
                logger.info('Firebase Admin SDK initialized from GOOGLE_APPLICATION_CREDENTIALS file');
                return firebaseApp;
            }
            logger.warn('GOOGLE_APPLICATION_CREDENTIALS file not found or invalid. FCM (iOS/Android) disabled. On Render set FIREBASE_SERVICE_ACCOUNT_BASE64.');
        }

        logger.warn('Firebase: no service account key found. Push (iOS/Android) disabled. On Render add env FIREBASE_SERVICE_ACCOUNT_BASE64 = base64(serviceAccountKey.json).');
        return null;
    } catch (error) {
        logger.error('Failed to initialize Firebase Admin SDK:', error);
        return null;
    }
};

export const getFirebaseApp = () => firebaseApp;

export const getMessaging = () => {
    if (!firebaseApp) {
        throw new InternalError('Firebase not initialized');
    }
    return admin.messaging();
};

export default admin;
