import logger from '../utils/winston/logger.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Понятные сообщения для типичных ошибок Cloudinary и загрузки файлов */
function getUserFriendlyMessage(err) {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('file size too large') || msg.includes('maximum is')) {
    return 'Размер фотографии превышает допустимый лимит (10 МБ). Пожалуйста, выберите фото меньшего размера или сожмите изображение.';
  }
  if (msg.includes('cloudinary') && msg.includes('limit')) {
    return 'Размер фотографии слишком большой. Выберите фото до 10 МБ или сожмите изображение.';
  }
  return null;
}

function getStatusAndMessage(err) {
  if (err.status != null && err.message) {
    const friendly = getUserFriendlyMessage(err) || err.message;
    return { status: err.status, message: friendly };
  }
  if (err.name === 'SequelizeDatabaseError' && err.message?.includes('does not exist')) {
    return { status: 400, message: 'Database table missing. Please run migrations.' };
  }
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors?.map((e) => e.message).filter(Boolean);
    return { status: 400, message: messages?.length ? messages.join('; ') : err.message || 'Validation failed' };
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return { status: 409, message: err.message || 'Duplicate value' };
  }
  const raw = err.message || 'Internal Server Error';
  const message = getUserFriendlyMessage(err) || raw;
  return { status: 500, message };
}

/**
 * Global error handler. Uses status from custom errors, maps Sequelize errors,
 * Cloudinary/file-size friendly messages, hides stack in production.
 * Sends both "error" and "message" for frontend compatibility.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const { status, message } = getStatusAndMessage(err);

  logger.error('Request error', {
    message: err.message,
    status,
    method: req.method,
    url: req.originalUrl || req.url,
    userId: req.user?.id ?? null,
    ...(IS_PRODUCTION ? {} : { stack: err.stack })
  });

  const body = { error: message, message };
  if (!IS_PRODUCTION && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
