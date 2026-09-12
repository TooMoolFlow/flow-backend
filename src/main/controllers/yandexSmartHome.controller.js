import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import * as YandexSmartHomeService from '../services/yandexSmartHome.service.js';

class YandexSmartHomeController {

    static saveTokens = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.saveTokens(req.body);
        res.json(result);
    });

    static getTokens = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.getTokens();
        res.json(result);
    });

    static deleteTokens = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.deleteTokens();
        res.json(result);
    });

    static refreshTokens = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.refreshTokens();
        res.json(result);
    });

    static getDevicesList = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.getDevicesList();
        res.json(result);
    });

    static createRoomDevice = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.createRoomDevice(req.body);
        res.status(201).json(result);
    });

    static getRoomDevices = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.getRoomDevices(req.params.meeting_room_id);
        res.json(result);
    });

    static getAllRoomDevices = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.getAllRoomDevices();
        res.json(result);
    });

    static deleteRoomDevice = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.deleteRoomDevice(req.params.id);
        res.json(result);
    });

    static controlDevice = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.controlDevice(req.body);
        res.json(result);
    });

    static getRoomDevicesForClient = asyncHandler(async (req, res) => {
        const result = await YandexSmartHomeService.getRoomDevicesForClient(req.params.meeting_room_id);
        res.json(result);
    });
}

export default YandexSmartHomeController;
