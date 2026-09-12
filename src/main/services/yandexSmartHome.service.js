import axios from 'axios';
import { YandexSmartHomeToken } from '../models/yandexSmartHomeToken.model.js';
import { MeetingRoomDevice } from '../models/meetingRoomDevice.model.js';
import { MeetingRoom } from '../models/meetingRoom.model.js';
import { Office } from '../models/office.model.js';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ConflictError, InternalError } from '../errors/errors.js';
import logger from '../utils/winston/logger.js';

const YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token';
const YANDEX_USER_INFO_URL = 'https://api.iot.yandex.net/v1.0/user/info';
const YANDEX_DEVICES_ACTIONS_URL = 'https://api.iot.yandex.net/v1.0/devices/actions';
const REQUEST_TIMEOUT_MS = 10000;

function normalizeYandexApiError(error, context = {}) {
    let message = 'Unknown error';
    let status = 500;
    if (error.response) {
        status = error.response.status || 500;
        const data = error.response.data || {};
        if (status === 401) message = 'Токен Яндекс умного дома истек или недействителен. Обновите токены';
        else if (status === 403) message = 'Доступ запрещен. Проверьте настройки токенов';
        else if (status === 404) message = 'Устройство не найдено в системе Яндекс';
        else if (status === 429) message = 'Превышен лимит запросов к API Яндекс. Попробуйте позже';
        else if (status >= 500) message = 'Ошибка сервера Яндекс API. Попробуйте позже';
        else message = data?.message || data?.error || error.message || 'Ошибка API Яндекс';
    } else if (error.request) {
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            message = 'Таймаут запроса к API Яндекс. Сервер не отвечает. Попробуйте позже';
            status = 504;
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            message = 'Не удалось подключиться к API Яндекс. Проверьте подключение к интернету';
            status = 503;
        } else if (error.code === 'ETIMEDOUT') {
            message = 'Таймаут подключения к API Яндекс. Попробуйте позже';
            status = 504;
        } else {
            message = 'Ошибка при запросе к API Яндекс. Попробуйте позже';
            status = 503;
        }
    } else {
        message = error.message || 'Ошибка при запросе к Яндекс API';
    }
    logger.error('Yandex API error', { ...context, error: message, status, responseData: error.response?.data });
    return new AppError(message, status);
}

async function ensureValidToken(tokenRecord) {
    if (!tokenRecord) throw new NotFoundError('Tokens not configured');
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
        const refreshed = await refreshToken(tokenRecord);
        if (!refreshed) throw new UnauthorizedError('Token expired and refresh failed');
        await tokenRecord.reload();
    }
    return tokenRecord;
}

async function getLatestToken() {
    const tokenRecord = await YandexSmartHomeToken.findOne({ order: [['created_at', 'DESC']] });
    if (!tokenRecord) throw new NotFoundError('Tokens not found');
    return tokenRecord;
}

/**
 * Обновляет токен через refresh_token. Возвращает true при успехе, false при ошибке.
 */
export async function refreshToken(tokenRecord) {
    if (!tokenRecord?.refresh_token) {
        logger.error('No refresh_token available', { tokenId: tokenRecord?.id });
        return false;
    }
    try {
        const response = await axios.post(
            YANDEX_TOKEN_URL,
            new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokenRecord.refresh_token,
                client_id: process.env.YANDEX_CLIENT_ID,
                client_secret: process.env.YANDEX_CLIENT_SECRET
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: REQUEST_TIMEOUT_MS }
        );
        const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
        tokenRecord.access_token = access_token;
        if (newRefreshToken) tokenRecord.refresh_token = newRefreshToken;
        if (expires_in) {
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);
            tokenRecord.expires_at = expiresAt;
        }
        tokenRecord.updated_at = new Date();
        await tokenRecord.save();
        logger.info('Token refreshed successfully', { tokenId: tokenRecord.id, expiresIn: expires_in });
        return true;
    } catch (error) {
        logger.error('Error refreshing token', { tokenId: tokenRecord.id, error: error.response?.data || error.message });
        return false;
    }
}

export async function saveTokens(body) {
    const { access_token, refresh_token, expires_at, expires_in } = body;
    if (!access_token || !refresh_token) {
        throw new BadRequestError('access_token and refresh_token are required');
    }
    let calculatedExpiresAt = null;
    if (expires_in) {
        calculatedExpiresAt = new Date();
        calculatedExpiresAt.setSeconds(calculatedExpiresAt.getSeconds() + expires_in);
    } else if (expires_at) {
        calculatedExpiresAt = new Date(expires_at);
    }
    let tokenRecord = await YandexSmartHomeToken.findOne({ where: { access_token } });
    const wasCreated = !tokenRecord;
    if (tokenRecord) {
        tokenRecord.access_token = access_token;
        tokenRecord.refresh_token = refresh_token;
        tokenRecord.expires_at = calculatedExpiresAt;
        tokenRecord.updated_at = new Date();
        await tokenRecord.save();
    } else {
        tokenRecord = await YandexSmartHomeToken.create({
            access_token,
            refresh_token,
            expires_at: calculatedExpiresAt,
            updated_at: new Date()
        });
    }
    logger.info('Tokens saved', { tokenId: tokenRecord.id, created: wasCreated ? 'new' : 'updated', expiresAt: calculatedExpiresAt });
    return {
        success: true,
        message: wasCreated ? 'Tokens created successfully' : 'Tokens updated successfully',
        data: { id: tokenRecord.id, expires_at: tokenRecord.expires_at }
    };
}

export async function getTokens() {
    const tokenRecord = await YandexSmartHomeToken.findOne({ order: [['created_at', 'DESC']] });
    if (!tokenRecord) throw new NotFoundError('Tokens not found');
    return {
        id: tokenRecord.id,
        expires_at: tokenRecord.expires_at,
        created_at: tokenRecord.created_at,
        updated_at: tokenRecord.updated_at,
        has_tokens: true
    };
}

export async function deleteTokens() {
    const tokenRecord = await YandexSmartHomeToken.findOne({ order: [['created_at', 'DESC']] });
    if (!tokenRecord) throw new NotFoundError('Tokens not found');
    await tokenRecord.destroy();
    logger.info('Tokens deleted', { tokenId: tokenRecord.id });
    return { success: true, message: 'Tokens deleted successfully' };
}

export async function refreshTokens() {
    const tokenRecord = await getLatestToken();
    const refreshed = await refreshToken(tokenRecord);
    if (!refreshed) throw new InternalError('Failed to refresh tokens');
    await tokenRecord.reload();
    return {
        success: true,
        message: 'Tokens refreshed successfully',
        data: { id: tokenRecord.id, expires_at: tokenRecord.expires_at, updated_at: tokenRecord.updated_at }
    };
}

export async function getDevicesList() {
    const tokenRecord = await YandexSmartHomeToken.findOne({ order: [['created_at', 'DESC']] });
    await ensureValidToken(tokenRecord);
    try {
        const response = await axios.get(YANDEX_USER_INFO_URL, {
            headers: { Authorization: `Bearer ${tokenRecord.access_token}` },
            timeout: REQUEST_TIMEOUT_MS
        });
        const devices = response.data?.devices || [];
        logger.info('Devices list retrieved for admin', { deviceCount: devices.length });
        return { success: true, devices };
    } catch (error) {
        throw normalizeYandexApiError(error, { context: 'getDevicesList' });
    }
}

export async function createRoomDevice(body) {
    const { meeting_room_id, device_id, device_name, device_type } = body;
    if (!meeting_room_id || !device_id || !device_name) {
        throw new BadRequestError('meeting_room_id, device_id, and device_name are required');
    }
    const room = await MeetingRoom.findByPk(meeting_room_id);
    if (!room) throw new NotFoundError('Meeting room not found');
    const existing = await MeetingRoomDevice.findOne({ where: { meeting_room_id, device_id } });
    if (existing) throw new ConflictError('Device already linked to this room');
    const roomDevice = await MeetingRoomDevice.create({
        meeting_room_id,
        device_id,
        device_name,
        device_type: device_type || null
    });
    logger.info('Room device created', { roomDeviceId: roomDevice.id, meetingRoomId: meeting_room_id, deviceId: device_id });
    return { success: true, message: 'Device linked to room successfully', data: roomDevice };
}

export async function getRoomDevices(meeting_room_id) {
    const devices = await MeetingRoomDevice.findAll({
        where: { meeting_room_id },
        order: [['created_at', 'ASC']]
    });
    return { success: true, devices };
}

export async function getAllRoomDevices() {
    const devices = await MeetingRoomDevice.findAll({
        include: [{
            model: MeetingRoom,
            as: 'meetingRoom',
            attributes: ['id', 'name', 'office_id'],
            include: [{ model: Office, as: 'office', attributes: ['id', 'name'] }]
        }],
        order: [['created_at', 'DESC']]
    });
    return { success: true, devices };
}

export async function deleteRoomDevice(id) {
    const roomDevice = await MeetingRoomDevice.findByPk(id);
    if (!roomDevice) throw new NotFoundError('Room device link not found');
    await roomDevice.destroy();
    logger.info('Room device deleted', { roomDeviceId: id });
    return { success: true, message: 'Device unlinked from room successfully' };
}

export async function controlDevice(body) {
    const { device_id, action_type, action_state } = body;
    if (!device_id || !action_type || !action_state) {
        throw new BadRequestError('device_id, action_type, and action_state are required');
    }
    const tokenRecord = await YandexSmartHomeToken.findOne({ order: [['created_at', 'DESC']] });
    await ensureValidToken(tokenRecord);
    try {
        const response = await axios.post(
            YANDEX_DEVICES_ACTIONS_URL,
            { devices: [{ id: device_id, actions: [{ type: action_type, state: action_state }] }] },
            {
                headers: { Authorization: `Bearer ${tokenRecord.access_token}`, 'Content-Type': 'application/json' },
                timeout: REQUEST_TIMEOUT_MS
            }
        );
        logger.info('Device controlled successfully', { deviceId: device_id, actionType: action_type });
        return { success: true, message: 'Device controlled successfully', data: response.data };
    } catch (error) {
        throw normalizeYandexApiError(error, { context: 'controlDevice', deviceId: device_id });
    }
}

export async function getRoomDevicesForClient(meeting_room_id) {
    const roomDevices = await MeetingRoomDevice.findAll({
        where: { meeting_room_id },
        order: [['created_at', 'ASC']]
    });
    if (roomDevices.length === 0) return { success: true, devices: [] };
    const tokenRecord = await YandexSmartHomeToken.findOne({ order: [['created_at', 'DESC']] });
    await ensureValidToken(tokenRecord);
    try {
        const response = await axios.get(YANDEX_USER_INFO_URL, {
            headers: { Authorization: `Bearer ${tokenRecord.access_token}` },
            timeout: REQUEST_TIMEOUT_MS
        });
        const allDevices = response.data?.devices || [];
        const deviceIds = roomDevices.map(rd => rd.device_id);
        const devices = allDevices.filter(d => deviceIds.includes(d.id));
        const enrichedDevices = devices.map(device => {
            const roomDevice = roomDevices.find(rd => rd.device_id === device.id);
            return { ...device, room_device_id: roomDevice?.id, room_device_name: roomDevice?.device_name };
        });
        return { success: true, devices: enrichedDevices };
    } catch (error) {
        throw normalizeYandexApiError(error, { context: 'getRoomDevicesForClient', meetingRoomId: meeting_room_id });
    }
}

