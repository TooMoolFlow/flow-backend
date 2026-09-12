#!/usr/bin/env node
/**
 * Миграция старых фото офисов и комнат в Cloudinary.
 * - Офисы: photo (base64 или URL) → upload → Cloudinary URL
 * - Комнаты: photos[] → для каждого не-Cloudinary URL upload → meeting_room_photos
 *
 * Запуск: node scripts/migrate-photos-to-cloudinary.js
 * Требует: .env с DB_* и CLOUDINARY_*
 */
import dotenv from 'dotenv';

dotenv.config();

import { sequelize } from '../src/main/config/database.config.js';
import { Office, MeetingRoom, MeetingRoomPhoto } from '../src/main/models/init.model.js';
import {
    uploadBase64ToCloudinary,
    uploadFromUrlToCloudinary,
} from '../src/main/utils/cloudinaryUpload.js';

async function migrateOffices() {
    const offices = await Office.findAll();
    let migrated = 0;
    for (const office of offices) {
        const photo = office.photo;
        if (!photo || photo.includes('cloudinary.com')) continue;
        try {
            let url;
            if (photo.startsWith('data:image')) {
                url = await uploadBase64ToCloudinary(photo, { folder: 'office_photos' });
            } else if (photo.startsWith('http://') || photo.startsWith('https://')) {
                url = await uploadFromUrlToCloudinary(photo, { folder: 'office_photos' });
            } else {
                console.warn(`[Office ${office.id}] Пропуск: неизвестный формат photo`);
                continue;
            }
            await office.update({ photo: url });
            migrated++;
            console.log(`[Office ${office.id}] Мигрировано → ${url.slice(0, 60)}...`);
        } catch (err) {
            console.error(`[Office ${office.id}] Ошибка:`, err.message);
        }
    }
    return migrated;
}

async function migrateMeetingRooms() {
    const rooms = await MeetingRoom.findAll();
    let migrated = 0;
    for (const room of rooms) {
        const photos = room.photos || [];
        if (photos.length === 0) continue;

        const existingPhotos = await MeetingRoomPhoto.findAll({
            where: { meeting_room_id: room.id },
            order: [['sort_order', 'ASC']],
        });
        if (existingPhotos.length > 0) {
            console.log(`[Room ${room.id}] Уже есть ${existingPhotos.length} фото в meeting_room_photos, пропуск`);
            continue;
        }

        let sortOrder = 0;
        for (const photo of photos) {
            if (!photo || typeof photo !== 'string') continue;
            if (photo.includes('cloudinary.com')) {
                await MeetingRoomPhoto.create({
                    meeting_room_id: room.id,
                    photo_url: photo,
                    sort_order: sortOrder++,
                });
                migrated++;
            } else if (photo.startsWith('http://') || photo.startsWith('https://')) {
                try {
                    const url = await uploadFromUrlToCloudinary(photo, { folder: 'meeting_rooms' });
                    await MeetingRoomPhoto.create({
                        meeting_room_id: room.id,
                        photo_url: url,
                        sort_order: sortOrder++,
                    });
                    migrated++;
                    console.log(`[Room ${room.id}] Мигрировано фото → ${url.slice(0, 60)}...`);
                } catch (err) {
                    console.error(`[Room ${room.id}] Ошибка фото:`, err.message);
                }
            } else if (photo.startsWith('data:image')) {
                try {
                    const url = await uploadBase64ToCloudinary(photo, { folder: 'meeting_rooms' });
                    await MeetingRoomPhoto.create({
                        meeting_room_id: room.id,
                        photo_url: url,
                        sort_order: sortOrder++,
                    });
                    migrated++;
                    console.log(`[Room ${room.id}] Мигрировано base64 → ${url.slice(0, 60)}...`);
                } catch (err) {
                    console.error(`[Room ${room.id}] Ошибка base64:`, err.message);
                }
            }
        }
    }
    return migrated;
}

async function run() {
    try {
        const { initDb } = await import('../src/main/config/database.config.js');
        await initDb();
        await sequelize.authenticate();
        console.log('БД подключена');

        const officesCount = await migrateOffices();
        console.log(`Офисы: мигрировано ${officesCount}`);

        const roomsCount = await migrateMeetingRooms();
        console.log(`Комнаты: мигрировано ${roomsCount} фото`);

        console.log('Миграция завершена');
    } catch (err) {
        console.error('Ошибка:', err);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

run();
