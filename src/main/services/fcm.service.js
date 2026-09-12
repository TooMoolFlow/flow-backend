import { getMessaging } from '../config/firebase.config.js';
import FCMToken from '../models/fcmToken.model.js';
import logger from '../utils/winston/logger.js';
import webpush from 'web-push';

class FCMService {
    constructor() {
        this.messaging = null;
        this._messagingPromise = null;
        this.vapidInitialized = false;
        this._initializeVAPID();
    }

    /**
     * Initialize VAPID keys for Web Push
     */
    _initializeVAPID() {
        if (this.vapidInitialized) return;

        const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.FIREBASE_WEB_PUSH_VAPID_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

        if (vapidPublicKey && vapidPrivateKey) {
            const vapidContactEmail = process.env.VAPID_CONTACT_EMAIL || 'noreply@kcell.kz';
            webpush.setVapidDetails(
                `mailto:${vapidContactEmail}`,
                vapidPublicKey,
                vapidPrivateKey
            );
            this.vapidInitialized = true;
            logger.info('✅ VAPID keys initialized for Web Push');
        } else {
            logger.warn('⚠️ VAPID keys not configured. Web Push notifications will not work. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
        }
    }

    /**
     * Get VAPID public key
     */
    getVAPIDPublicKey() {
        return process.env.VAPID_PUBLIC_KEY || process.env.FIREBASE_WEB_PUSH_VAPID_KEY || null;
    }

    /**
     * Convert all data values to strings for FCM compatibility
     */
    _stringifyData(data) {
        const stringifiedData = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) {
                stringifiedData[key] = '';
            } else {
                stringifiedData[key] = String(value);
            }
        }
        return stringifiedData;
    }

    _isHighPriority(data = {}) {
        return String(data?.priority || '').toLowerCase() === 'high';
    }

    /**
     * Группирует токены по платформам для оптимизации отправки
     */
    async _groupTokensByPlatform(tokens) {
        const groups = {
            ios: [],
            android: [],
            web: []
        };

        for (const token of tokens) {
            try {
                const tokenInfo = await FCMToken.findOne({ 
                    where: { token },
                    attributes: ['platform']
                });
                const platform = tokenInfo ? tokenInfo.platform : 'android';
                
                if (groups[platform]) {
                    groups[platform].push(token);
                } else {
                    groups.android.push(token); // fallback to android
                }
            } catch (error) {
                logger.warn(`Error getting platform for token ${token.substring(0, 20)}...:`, error.message);
                groups.android.push(token); // fallback to android
            }
        }

        return groups;
    }

    /**
     * Get messaging instance with lazy loading
     */
    async getMessaging() {
        if (this.messaging) {
            return this.messaging;
        }

        if (this._messagingPromise) {
            return this._messagingPromise;
        }

        this._messagingPromise = this._initializeMessaging();
        return this._messagingPromise;
    }

    /**
     * Initialize messaging instance
     */
    async _initializeMessaging() {
        try {
            this.messaging = getMessaging();
            return this.messaging;
        } catch (error) {
            logger.warn('FCM messaging not available:', error.message);
            return null;
        }
    }

    /**
     * Сохранить FCM токен пользователя
     */
    async saveToken(userId, token, platform = 'android', deviceId = null) {
        try {
            // Для web платформы не требуется Firebase messaging
            if (platform !== 'web') {
                const messaging = await this.getMessaging();
                if (!messaging) {
                    logger.warn('FCM not initialized, token not saved');
                    return { success: false, message: 'FCM not available' };
                }
            }

            // Проверяем, существует ли токен
            const existingToken = await FCMToken.findOne({
                where: { token }
            });

            if (existingToken) {
                // Обновляем существующий токен
                await existingToken.update({
                    user_id: userId,
                    platform,
                    device_id: deviceId,
                    last_used: new Date(),
                    is_active: true
                });
                logger.info(`FCM token updated for user ${userId}`);
            } else {
                // Создаем новый токен
                await FCMToken.create({
                    user_id: userId,
                    token,
                    platform,
                    device_id: deviceId,
                    last_used: new Date()
                });
                logger.info(`FCM token saved for user ${userId}`);
            }

            return { success: true, message: 'Token saved successfully' };
        } catch (error) {
            logger.error('Error saving FCM token:', error);
            return { success: false, message: 'Failed to save token' };
        }
    }

    /**
     * Удалить FCM токен
     */
    async deleteToken(token) {
        try {
            const result = await FCMToken.destroy({
                where: { token }
            });

            if (result > 0) {
                logger.info(`FCM token deleted: ${token.substring(0, 20)}...`);
                return { success: true, message: 'Token deleted successfully' };
            } else {
                return { success: false, message: 'Token not found' };
            }
        } catch (error) {
            logger.error('Error deleting FCM token:', error);
            return { success: false, message: 'Failed to delete token' };
        }
    }

    /**
     * Отправить Web Push уведомление
     */
    async _sendWebPushNotification(subscriptionJson, title, body, data = {}) {
        try {
            if (!this.vapidInitialized) {
                logger.warn('VAPID keys not initialized, Web Push notification not sent');
                return { success: false, message: 'VAPID keys not configured' };
            }

            // Парсим subscription из JSON строки
            const subscription = typeof subscriptionJson === 'string' 
                ? JSON.parse(subscriptionJson) 
                : subscriptionJson;

            const isHighPriority = this._isHighPriority(data);
            const payload = JSON.stringify({
                notification: {
                    title,
                    body,
                    icon: '/icon-192x192.png',
                    badge: '/icon-192x192.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: isHighPriority
                },
                data: {
                    ...data,
                    url: data.url || '/'
                }
            });

            await webpush.sendNotification(subscription, payload);
            logger.info('✅ Web Push notification sent successfully');
            return { success: true, messageId: 'web-push-sent' };
        } catch (error) {
            logger.error('❌ Error sending Web Push notification:', error);
            
            // Если subscription недействителен, возвращаем ошибку
            if (error.statusCode === 410 || error.statusCode === 404) {
                return { success: false, message: 'Subscription expired or invalid' };
            }
            
            return { success: false, message: error.message || 'Failed to send Web Push notification' };
        }
    }

    /**
     * Отправить уведомление на конкретный токен
     */
    async sendToToken(token, title, body, data = {}) {
        try {
            // Получаем информацию о платформе токена
            const tokenInfo = await FCMToken.findOne({ where: { token } });
            const platform = tokenInfo ? tokenInfo.platform : 'android';

            // Для web платформы используем Web Push API
            if (platform === 'web') {
                const result = await this._sendWebPushNotification(token, title, body, data);
                
                if (result.success) {
                    // Обновляем время последнего использования
                    await FCMToken.update(
                        { last_used: new Date() },
                        { where: { token } }
                    );
                } else if (result.message.includes('expired') || result.message.includes('invalid')) {
                    // Удаляем недействительный токен
                    await this.deleteToken(token);
                }
                
                return result;
            }

            // Для iOS и Android используем Firebase
            const messaging = await this.getMessaging();
            if (!messaging) {
                logger.warn('FCM not initialized, notification not sent');
                return { success: false, message: 'FCM not available' };
            }

            const isHighPriority = this._isHighPriority(data);
            const message = {
                notification: {
                    title,
                    body
                },
                data: {
                    ...this._stringifyData(data),
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                token
            };

            // Добавляем специфичные для iOS настройки с звуком
            if (platform === 'ios') {
                message.apns = {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                            'content-available': 1,
                            'mutable-content': 1,
                            ...(isHighPriority ? { 'interruption-level': 'time-sensitive' } : {})
                        }
                    },
                    headers: {
                        'apns-priority': '10',
                        'apns-push-type': 'alert'
                    }
                };

                // Expo iOS actions use APNs `category` to show action buttons.
                const category = data?.category || data?.categoryIdentifier || (data?.type === 'task_reminder' ? 'task_reminder' : null);
                if (category) {
                    message.apns.payload.aps.category = String(category);
                }
            } else if (platform === 'android') {
                // Настройки для Android с звуком
                message.android = {
                    notification: {
                        sound: 'default',
                        channel_id: isHighPriority ? 'high_priority' : 'default',
                        priority: 'high',
                        default_sound: true,
                        default_vibrate_timings: true,
                        default_light_settings: true
                    },
                    priority: 'high'
                };
            }

            const response = await messaging.send(message);
            logger.info(`Notification sent to token (${platform}): ${response}`);
            
            // Обновляем время последнего использования
            await FCMToken.update(
                { last_used: new Date() },
                { where: { token } }
            );

            return { success: true, messageId: response };
        } catch (error) {
            logger.error('Error sending notification to token:', error);

            // Ошибка доставки на iOS: в Firebase не настроен APNs ключ (Apple)
            if (error.code === 'messaging/third-party-auth-error') {
                logger.warn('FCM third-party-auth-error: для доставки на iPhone загрузите APNs Authentication Key (.p8) в Firebase Console → Project Settings → Cloud Messaging → Apple app configuration.');
            }
            
            // Если токен недействителен, удаляем его
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                await this.deleteToken(token);
                return { success: false, message: 'Invalid token, removed from database' };
            }
            
            return { success: false, message: 'Failed to send notification' };
        }
    }

    /**
     * Отправить уведомление пользователю
     */
    async sendToUser(userId, title, body, data = {}) {
        try {
            logger.info(`Attempting to send notification to user ${userId}`);
            
            const tokens = await FCMToken.findAll({
                where: { 
                    user_id: userId,
                    is_active: true
                }
            });

            if (tokens.length === 0) {
                logger.warn(`No active tokens found for user ${userId}`);
                return { success: false, message: 'No active tokens found for user' };
            }

            logger.info(`Found ${tokens.length} active tokens for user ${userId}`);
            const tokenList = tokens.map(t => t.token);
            const result = await this.sendMulticast(tokenList, title, body, data);
            
            if (!result.success) {
                logger.error(`Failed to send notification to user ${userId}:`, result.message);
            }
            
            return result;
        } catch (error) {
            logger.error('Error sending notification to user:', {
                userId,
                error: error.message,
                stack: error.stack
            });
            return { success: false, message: 'Failed to send notification to user' };
        }
    }

    /**
     * Отправить уведомление на тему
     */
    async sendToTopic(topic, title, body, data = {}) {
        try {
            const messaging = await this.getMessaging();
            if (!messaging) {
                logger.warn('FCM not initialized, topic notification not sent');
                return { success: false, message: 'FCM not available' };
            }

            const message = {
                notification: {
                    title,
                    body
                },
                data: {
                    ...this._stringifyData(data),
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                topic
            };

            // Добавляем настройки для iOS и Android с звуком
            message.apns = {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                        'content-available': 1,
                        'mutable-content': 1
                    }
                },
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert'
                }
            };

            message.android = {
                notification: {
                    sound: 'default',
                    channel_id: 'default',
                    priority: 'high',
                    default_sound: true,
                    default_vibrate_timings: true,
                    default_light_settings: true
                },
                priority: 'high'
            };

            const response = await messaging.send(message);
            logger.info(`Topic notification sent to ${topic}: ${response}`);
            
            return { success: true, messageId: response };
        } catch (error) {
            logger.error('Error sending topic notification:', error);
            return { success: false, message: 'Failed to send topic notification' };
        }
    }

    /**
     * Массовая отправка уведомлений
     */
    async sendMulticast(tokens, title, body, data = {}) {
        try {
            const isHighPriority = this._isHighPriority(data);
            if (!tokens || tokens.length === 0) {
                return { success: false, message: 'No tokens provided' };
            }

            logger.info(`Attempting to send multicast to ${tokens.length} tokens`);
            logger.debug('Multicast data:', { title, body, data: this._stringifyData(data) });

            // Группируем токены по платформам для оптимизации
            const tokenGroups = await this._groupTokensByPlatform(tokens);
            
            let totalSuccessCount = 0;
            let totalFailureCount = 0;

            // Сначала обрабатываем web токены отдельно (Web Push API - не требует Firebase)
            if (tokenGroups.web && tokenGroups.web.length > 0) {
                logger.info(`Sending Web Push notifications to ${tokenGroups.web.length} web tokens`);
                
                for (const webToken of tokenGroups.web) {
                    try {
                        const result = await this._sendWebPushNotification(webToken, title, body, data);
                        if (result.success) {
                            totalSuccessCount++;
                            // Обновляем время последнего использования
                            await FCMToken.update(
                                { last_used: new Date() },
                                { where: { token: webToken } }
                            );
                        } else {
                            totalFailureCount++;
                            // Если subscription недействителен, удаляем токен
                            if (result.message.includes('expired') || result.message.includes('invalid')) {
                                await this.deleteToken(webToken);
                            }
                        }
                    } catch (error) {
                        totalFailureCount++;
                        logger.error(`Error sending Web Push to token ${webToken.substring(0, 20)}...:`, error);
                    }
                }
            }

            // Отправляем уведомления для iOS и Android через Firebase (требует инициализации Firebase)
            const hasAndroidOrIosTokens = (tokenGroups.android && tokenGroups.android.length > 0) || 
                                         (tokenGroups.ios && tokenGroups.ios.length > 0);
            
            if (hasAndroidOrIosTokens) {
                const messaging = await this.getMessaging();
                if (!messaging) {
                    logger.warn('FCM not initialized, Android/iOS notifications not sent');
                    totalFailureCount += (tokenGroups.android?.length || 0) + (tokenGroups.ios?.length || 0);
                } else {
                    // Отправляем уведомления для iOS и Android через Firebase
                    for (const [platform, platformTokens] of Object.entries(tokenGroups)) {
                        if (platformTokens.length === 0 || platform === 'web') continue;

                        const message = {
                            notification: {
                                title,
                                body
                            },
                            data: {
                                ...this._stringifyData(data),
                                click_action: 'FLUTTER_NOTIFICATION_CLICK'
                            },
                            tokens: platformTokens
                        };

                        // Добавляем специфичные настройки для платформы с звуком
                        if (platform === 'ios') {
                            message.apns = {
                                payload: {
                                    aps: {
                                        sound: 'default',
                                        badge: 1,
                                        'content-available': 1,
                                        'mutable-content': 1,
                                        ...(isHighPriority ? { 'interruption-level': 'time-sensitive' } : {})
                                    }
                                },
                                headers: {
                                    'apns-priority': '10',
                                    'apns-push-type': 'alert'
                                }
                            };
                            // Expo iOS actions use APNs `category` to show action buttons (same as sendToToken).
                            const category = data?.category || data?.categoryIdentifier || (data?.type === 'task_reminder' ? 'task_reminder' : null);
                            if (category) {
                                message.apns.payload.aps.category = String(category);
                            }
                        } else if (platform === 'android') {
                            message.android = {
                                notification: {
                                    sound: 'default',
                                    channel_id: isHighPriority ? 'high_priority' : 'default',
                                    priority: 'high',
                                    default_sound: true,
                                    default_vibrate_timings: true,
                                    default_light_settings: true
                                },
                                priority: 'high'
                            };
                        }

                        try {
                            const response = await messaging.sendMulticast(message);
                    
                    logger.info(`Multicast notification sent to ${platform}:`, {
                        successCount: response.successCount,
                        failureCount: response.failureCount
                    });

                    totalSuccessCount += response.successCount;
                    totalFailureCount += response.failureCount;

                    // Обрабатываем недействительные токены
                    if (response.failureCount > 0) {
                        const failedTokens = [];
                        response.responses.forEach((resp, idx) => {
                            if (!resp.success) {
                                failedTokens.push(platformTokens[idx]);
                            }
                        });

                        // Удаляем недействительные токены
                        for (const token of failedTokens) {
                            await this.deleteToken(token);
                        }
                    }
                } catch (platformError) {
                    logger.warn(`Multicast failed for ${platform}, falling back to individual messages:`, platformError.message);
                    
                    // Fallback to individual messages for this platform
                    for (const token of platformTokens) {
                        try {
                            await this.sendToToken(token, title, body, data);
                            totalSuccessCount++;
                        } catch (individualError) {
                            totalFailureCount++;
                            logger.error(`Failed to send individual message to ${platform} token ${token.substring(0, 20)}...:`, {
                                error: individualError.message || individualError.toString(),
                                code: individualError.code
                            });
                        }
                    }
                }
                    }
                }
            }

            const result = {
                success: totalSuccessCount > 0,
                successCount: totalSuccessCount,
                failureCount: totalFailureCount,
                message: totalSuccessCount > 0 ? 'Notifications sent successfully' : 'All notifications failed'
            };
            
            if (totalFailureCount > 0) {
                logger.warn(`Multicast completed with ${totalFailureCount} failures out of ${tokens.length} tokens`);
            }
            
            return result;
        } catch (error) {
            logger.error('Error sending multicast notification:', error);
            return { success: false, message: 'Failed to send multicast notification' };
        }
    }

    /**
     * Подписать токен на тему
     */
    async subscribeToTopic(tokens, topic) {
        try {
            const messaging = await this.getMessaging();
            if (!messaging) {
                logger.warn('FCM not initialized, subscription failed');
                return { success: false, message: 'FCM not available' };
            }

            const response = await messaging.subscribeToTopic(tokens, topic);
            logger.info(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
            
            return { success: true, successCount: response.successCount, failureCount: response.failureCount };
        } catch (error) {
            logger.error('Error subscribing to topic:', error);
            return { success: false, message: 'Failed to subscribe to topic' };
        }
    }

    /**
     * Отписать токен от темы
     */
    async unsubscribeFromTopic(tokens, topic) {
        try {
            const messaging = await this.getMessaging();
            if (!messaging) {
                logger.warn('FCM not initialized, unsubscription failed');
                return { success: false, message: 'FCM not available' };
            }

            const response = await messaging.unsubscribeFromTopic(tokens, topic);
            logger.info(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
            
            return { success: true, successCount: response.successCount, failureCount: response.failureCount };
        } catch (error) {
            logger.error('Error unsubscribing from topic:', error);
            return { success: false, message: 'Failed to unsubscribe from topic' };
        }
    }

    /**
     * Получить все токены пользователя
     */
    async getUserTokens(userId) {
        try {
            const tokens = await FCMToken.findAll({
                where: { 
                    user_id: userId,
                    is_active: true
                },
                attributes: ['id', 'token', 'platform', 'device_id', 'last_used', 'created_at']
            });

            return { success: true, tokens };
        } catch (error) {
            logger.error('Error getting user tokens:', error);
            return { success: false, message: 'Failed to get user tokens' };
        }
    }

    /**
     * Получить все активные токены
     */
    async getAllActiveTokens() {
        try {
            const tokens = await FCMToken.findAll({
                where: { is_active: true },
                attributes: ['id', 'token', 'platform', 'device_id', 'last_used', 'created_at']
            });

            return { success: true, tokens };
        } catch (error) {
            logger.error('Error getting all active tokens:', error);
            return { success: false, message: 'Failed to get all active tokens' };
        }
    }

    /**
     * Получить статистику токенов
     */
    async getTokenStats() {
        try {
            const totalTokens = await FCMToken.count();
            const activeTokens = await FCMToken.count({ where: { is_active: true } });
            const androidTokens = await FCMToken.count({ where: { platform: 'android', is_active: true } });
            const iosTokens = await FCMToken.count({ where: { platform: 'ios', is_active: true } });
            const webTokens = await FCMToken.count({ where: { platform: 'web', is_active: true } });

            return {
                success: true,
                stats: {
                    total: totalTokens,
                    active: activeTokens,
                    android: androidTokens,
                    ios: iosTokens,
                    web: webTokens
                }
            };
        } catch (error) {
            logger.error('Error getting token stats:', error);
            return { success: false, message: 'Failed to get token stats' };
        }
    }

    /**
     * Проверить валидность токена
     */
    async validateToken(token) {
        try {
            // Получаем информацию о платформе токена
            const tokenInfo = await FCMToken.findOne({ where: { token } });
            const platform = tokenInfo ? tokenInfo.platform : 'android';

            // Для web платформы используем Web Push API
            if (platform === 'web') {
                try {
                    const result = await this._sendWebPushNotification(
                        token, 
                        'Test', 
                        'Token validation',
                        { type: 'validation', timestamp: new Date().toISOString() }
                    );
                    
                    if (result.success) {
                        return { success: true, message: 'Token is valid' };
                    } else {
                        // Если subscription недействителен, удаляем токен
                        if (result.message.includes('expired') || result.message.includes('invalid')) {
                            await this.deleteToken(token);
                            return { success: false, message: 'Token is invalid and has been removed' };
                        }
                        return { success: false, message: 'Token validation failed' };
                    }
                } catch (error) {
                    logger.error('Web Push token validation failed:', {
                        token: token.substring(0, 20) + '...',
                        error: error.message
                    });
                    await this.deleteToken(token);
                    return { success: false, message: 'Token is invalid and has been removed' };
                }
            }

            // Для iOS и Android используем Firebase
            const messaging = await this.getMessaging();
            if (!messaging) {
                return { success: false, message: 'FCM not available' };
            }

            // Отправляем тестовое сообщение для проверки валидности
            const testMessage = {
                notification: {
                    title: 'Test',
                    body: 'Token validation'
                },
                data: {
                    type: 'validation',
                    timestamp: new Date().toISOString()
                },
                token
            };

            await messaging.send(testMessage);
            return { success: true, message: 'Token is valid' };
        } catch (error) {
            logger.error('Token validation failed:', {
                token: token.substring(0, 20) + '...',
                error: error.message,
                code: error.code
            });
            
            // Если токен недействителен, удаляем его
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                await this.deleteToken(token);
                return { success: false, message: 'Token is invalid and has been removed' };
            }
            
            return { success: false, message: 'Token validation failed' };
        }
    }

    /**
     * Очистить недействительные токены
     */
    async cleanupInvalidTokens() {
        try {
            const tokens = await FCMToken.findAll({
                where: { is_active: true }
            });

            let removedCount = 0;
            for (const tokenRecord of tokens) {
                const validation = await this.validateToken(tokenRecord.token);
                if (!validation.success) {
                    removedCount++;
                }
            }

            logger.info(`Cleaned up ${removedCount} invalid tokens`);
            return { success: true, removedCount };
        } catch (error) {
            logger.error('Error cleaning up invalid tokens:', error);
            return { success: false, message: 'Failed to cleanup invalid tokens' };
        }
    }

}

export default new FCMService();
