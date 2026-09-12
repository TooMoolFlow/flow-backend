import axios from 'axios';
import { InternalError } from '../errors/errors.js';
import logger from '../utils/winston/logger.js';

export default {
    async analyzeRequest(request, photos = []) {
        // Формируем описание фото
        const photoDescriptions = photos.length > 0
            ? photos.map((p, i) => `Фото ${i + 1}: ${p.photo_url}`).join('\n')
            : "Нет прикреплённых фото.";

        // Формируем промпт
        const prompt = `
Ты — помощник службы поддержки. Клиент прислал заявку:
Заявка: "${request}"
Фото:
${photoDescriptions}

На основе этого определи:
- Нужно ли отклонить заявку (если это спам, неадекват или неполноценная заявка)
- Если не отклонять, то выбери:
  • complexity: 'simple', 'medium', 'complex'
  • sla: '1h', '4h', '8h', '1d', '3d', '1w'
Ответ верни строго в формате JSON:

{
  "status": "awaiting_assignment" | "rejected",
  "rejection_reason": "...", // если rejected
  "complexity": "...",
  "sla": "...",
}
`.trim();

        try {
            // Выполняем запрос к API
            const response = await axios.post(
                process.env.CHAT_API_URL,
                {
                    model: "deepseek/deepseek-chat-v3-0324:free",
                    messages: [
                        {
                            role: "system",
                            content: "Ты должен отвечать только в формате JSON, без пояснений, без тегов или комментариев."
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3,
                    response_format: { type: "json_object" } // Добавляем явное указание формата ответа
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.API_TOKEN}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 10000 // 10 секунд таймаут
                }
            );

            // Обрабатываем ответ
            if (!response.data?.choices?.[0]?.message?.content) {
                throw new InternalError("Invalid API response structure");
            }

            const content = response.data.choices[0].message.content;

            try {
                // Пытаемся найти JSON в ответе
                const jsonStart = content.indexOf('{');
                const jsonEnd = content.lastIndexOf('}');

                if (jsonStart === -1 || jsonEnd === -1) {
                    throw new InternalError("No JSON found in response");
                }

                const jsonString = content.slice(jsonStart, jsonEnd + 1);
                const result = JSON.parse(jsonString);

                // Валидация структуры ответа
                if (!result.status || (result.status === 'rejected' && !result.rejection_reason) ||
                    (result.status === 'awaiting_assignment' && (!result.complexity || !result.sla))) {
                    throw new InternalError("Invalid response format");
                }

                return result;
            } catch (parseError) {
                logger.error('Failed to parse AI response', { error: parseError?.message, rawContent: content?.slice(0, 200) });
                throw new InternalError("Failed to parse AI response");
            }
        } catch (error) {
            logger.error('AI analysis failed', {
                error: error.response?.data || error.message,
                request: {
                    description: request?.description,
                    photos: photos?.map(p => p.photo_url)
                }
            });

            // Возвращаем fallback-ответ в случае ошибки
            return {
                status: "awaiting_assignment",
                complexity: "medium",
                sla: "8h"
            };

            // Или можно пробросить ошибку дальше:
            // throw new Error("AI analysis failed: " + error.message);
        }
    }
}