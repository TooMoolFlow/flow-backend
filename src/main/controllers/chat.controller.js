import { BadRequestError, InternalError } from '../errors/errors.js';
import * as ChatService from '../services/chat.service.js';
import logger from '../utils/winston/logger.js';

/**
 * POST /api/chat
 * Chat with Gemini AI. Открытый эндпоинт (auth не обязателен, req.user может быть пустым).
 * Ошибки передаются в централизованный errorHandler.
 */
export const postChat = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new BadRequestError('Message is required');
    }

    const userRole = req.user?.role ?? null;
    const result = await ChatService.sendChatMessage(message.trim(), userRole);
    res.json(result);
  } catch (error) {
    if (error?.response?.status === 404) {
      const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';
      ChatService.logGeminiModelNotFound(modelName, error?.response?.data);
    } else {
      logger.error('Gemini API error', {
        message: error?.message,
        response: error?.response?.data
      });
    }
    const toSend = error.status != null ? error : new InternalError('Ошибка при обращении к Gemini API. Попробуйте позже.');
    next(toSend);
  }
};
