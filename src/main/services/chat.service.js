import axios from 'axios';
import buildPrompt from '../utils/AI/promptTemplate.js';
import logger from '../utils/winston/logger.js';
import { InternalError } from '../errors/errors.js';

const GEMINI_API_VERSION = 'v1';
const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Send message to Gemini and return bot reply.
 * @param {string} message - User message
 * @param {string|null} userRole - User role for context
 * @returns {Promise<{ answer: string }>}
 */
export async function sendChatMessage(message, userRole = null) {
  const modelName = process.env.GEMINI_MODEL_NAME || DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new InternalError('GEMINI_API_KEY is not configured');
  }

  const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await axios.post(
    url,
    {
      contents: [
        {
          parts: [{ text: buildPrompt(message, userRole) }]
        }
      ],
      generationConfig: { temperature: 0.3 }
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    }
  );

  const botReply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!botReply) {
    throw new InternalError('Empty response from Gemini');
  }

  try {
    const parsed = JSON.parse(botReply);
    return {
      answer: parsed.response || parsed.answer || botReply || 'Не получилось обработать ответ.'
    };
  } catch {
    return { answer: botReply };
  }
}

/**
 * Log Gemini 404 (model not found) for debugging.
 * @param {string} modelName
 * @param {object} errorResponse
 */
export function logGeminiModelNotFound(modelName, errorResponse) {
  logger.error({
    message: `Gemini model not found: ${modelName}. Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-2.0-flash-001. Set GEMINI_MODEL_NAME env variable to use different model.`,
    modelName,
    apiVersion: GEMINI_API_VERSION,
    error: errorResponse
  });
}
