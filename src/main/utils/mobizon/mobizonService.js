import axios from "axios";
import dotenv from "dotenv";
import logger from "../winston/logger.js";

dotenv.config();

const MOBIZON_API_KEY = process.env.MOBIZON_API_KEY;
const MOBIZON_API_URL = process.env.MOBIZON_API_URL || "https://api.mobizon.kz/service/Message/SendSmsMessage";
// const MOBIZON_SENDER = process.env.MOBIZON_SENDER || "Workflow"; // Подпись отправителя

/**
 * Отправляет SMS через Mobizon API
 * @param {string} phone - Номер телефона в формате +7 XXX XXX XX XX
 * @param {string} message - Текст сообщения
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function sendSMS(phone, message) {
    try {
        if (!MOBIZON_API_KEY) {
            logger.error("MOBIZON_API_KEY не установлен в переменных окружения");
            return {
                success: false,
                error: "MOBIZON_API_KEY не настроен"
            };
        }

        // Преобразуем номер телефона из формата +7 XXX XXX XX XX в формат 7XXXXXXXXXX
        const formattedPhone = phone.replace(/\s+/g, "").replace("+", "");

        // // Формируем URL для GET запроса к Mobizon API с указанием подписи отправителя
        // const url = `${MOBIZON_API_URL}?recipient=${formattedPhone}&text=${encodeURIComponent(message)}&from=${encodeURIComponent(MOBIZON_SENDER)}&apiKey=${MOBIZON_API_KEY}`;

        const url = `${MOBIZON_API_URL}?recipient=${formattedPhone}&text=${encodeURIComponent(message)}&apiKey=${MOBIZON_API_KEY}`;
        logger.info(`Отправка SMS на номер ${phone} через Mobizon API`);

        const response = await axios.get(url, {
            timeout: 10000
        });

        // Проверяем ответ от Mobizon API
        if (response.data && response.data.code === 0) {
            logger.info(`SMS успешно отправлено на номер ${phone}`);
            return {
                success: true,
                message: "SMS успешно отправлено"
            };
        } else {
            const errorMessage = response.data?.message || "Неизвестная ошибка от Mobizon API";
            logger.error(`Ошибка отправки SMS через Mobizon: ${errorMessage}`, {
                response: response.data
            });
            return {
                success: false,
                error: errorMessage
            };
        }
    } catch (error) {
        logger.error("Ошибка при отправке SMS через Mobizon API:", {
            error: error.message,
            stack: error.stack,
            phone
        });

        if (error.response) {
            return {
                success: false,
                error: `Ошибка Mobizon API: ${error.response.data?.message || error.message}`
            };
        }

        return {
            success: false,
            error: `Ошибка при отправке SMS: ${error.message}`
        };
    }
}

/**
 * Отправляет код подтверждения через SMS
 * @param {string} phone - Номер телефона
 * @param {string} code - Код подтверждения
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function sendVerificationCode(phone, code) {
    const message = `Ваш код подтверждения: ${code}`;
    return await sendSMS(phone, message);
}

