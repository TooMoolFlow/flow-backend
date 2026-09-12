import fs from 'fs/promises';
import { MeetingRoomPhoto, MeetingRoom } from '../models/init.model.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';
import { uploadToCloudinary, deleteFromCloudinaryByUrl } from '../utils/cloudinaryUpload.js';

const FOLDER = 'meeting_rooms';
const MAX_PHOTOS = 10;

class MeetingRoomPhotoService {
    static async addPhotos(roomId, files) {
        const room = await MeetingRoom.findByPk(roomId);
        if (!room) {
            throw new NotFoundError(`Meeting room with id ${roomId} not found`);
        }

        const existing = await MeetingRoomPhoto.count({ where: { meeting_room_id: roomId } });
        const toAdd = files?.length || 0;
        if (existing + toAdd > MAX_PHOTOS) {
            throw new BadRequestError(`Максимум ${MAX_PHOTOS} фото на комнату`);
        }

        if (!files || files.length === 0) {
            return [];
        }

        const photos = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const result = await uploadToCloudinary(file.path, { folder: FOLDER });
                const photo = await MeetingRoomPhoto.create({
                    meeting_room_id: roomId,
                    photo_url: result.secure_url,
                    sort_order: existing + i,
                });
                photos.push(photo);
            } catch (err) {
                const msg = (err.message || '').toLowerCase();
                if (msg.includes('file size too large') || msg.includes('maximum is')) {
                    throw new BadRequestError(
                        'Размер фотографии превышает допустимый лимит (10 МБ). Выберите фото меньшего размера.',
                    );
                }
                throw err;
            } finally {
                await fs.unlink(file.path).catch(() => {});
            }
        }
        return photos;
    }

    static async deletePhoto(roomId, photoId) {
        const photo = await MeetingRoomPhoto.findOne({
            where: { id: photoId, meeting_room_id: roomId },
        });
        if (!photo) {
            throw new NotFoundError('Фото не найдено');
        }
        await deleteFromCloudinaryByUrl(photo.photo_url);
        await photo.destroy();
        return { deleted: true };
    }
}

export default MeetingRoomPhotoService;
