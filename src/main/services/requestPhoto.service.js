import fs from 'fs/promises';
import { RequestPhoto, RequestGroup } from '../models/init.model.js';
import { NotFoundError, BadRequestError } from '../errors/errors.js';
import RequestLogger from '../utils/requestLogger.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';
import logger from '../utils/winston/logger.js';

const ALLOWED_TYPES = ['before', 'after'];

class RequestPhotoService {
  static async getAllRequestPhotos() {
    return await RequestPhoto.findAll()
  }
  static async getRequestPhotoById(id) {
    const photo = await RequestPhoto.findByPk(id)
    if (!photo) {
      throw new NotFoundError('Photo not found')
    }
    return photo
  }
  static async createRequestPhoto(photoData) {
    return await RequestPhoto.create(photoData)
  }
  static async updateRequestPhoto(id, updateData) {
    const photo = await RequestPhoto.update(updateData, {
      where: {id: id}
    })
    if (!photo) {
      throw new NotFoundError('Request photo not found')
    }
    return await RequestPhoto.findByPk(id)
  }
  static async deleteRequestPhoto(id) {
    const photo = await RequestPhoto.destroy({where: {id: id}})
    if (!photo) {
      throw new NotFoundError('Request photo not found')
    }
    return photo
  }
  static async getPhotosByRequestId(requestId) {
    const photos = await RequestPhoto.findAll({ where: { request_id: requestId } });
    return photos || [];
  }

  /**
   * Загрузка фотографий по заявке. Проверяет существование заявки, валидирует файлы и тип.
   * @param {string} requestId - ID заявки (RequestGroup)
   * @param {Array} files - массив файлов (multer)
   * @param {string} type - 'before' | 'after'
   * @param {object} options - { userId, req, transaction }
   */
  static async uploadPhotos(requestId, files, type, options = {}) {
    const request = await RequestGroup.findByPk(requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }
    if (!files || files.length === 0) {
      throw new BadRequestError('Нет файлов для загрузки');
    }
    if (!type || !ALLOWED_TYPES.includes(type)) {
      throw new BadRequestError('Неверный тип фотографии (before/after)');
    }
    const savedPhotos = [];
    for (const file of files) {
      const photo = await RequestPhotoService.uploadRequestPhoto(
        file,
        requestId,
        type,
        options.userId ?? null,
        options.req ?? null,
        options.transaction ?? null
      );
      savedPhotos.push(photo);
    }
    return savedPhotos;
  }

  static async uploadRequestPhoto(file, requestId, type, userId = null, req = null, transaction = null) {
    let result;
    try {
      result = await uploadToCloudinary(file.path, { folder: 'request_photos' });
    } catch (uploadErr) {
      const msg = (uploadErr.message || '').toLowerCase();
      if (msg.includes('file size too large') || msg.includes('maximum is')) {
        throw new BadRequestError('Размер фотографии превышает допустимый лимит (10 МБ). Пожалуйста, выберите фото меньшего размера или сожмите изображение.');
      }
      throw uploadErr;
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }

    // 3. Сохраняем в БД (под транзакцию)
    const photo = await RequestPhoto.create({
      request_id: requestId,
      photo_url: result.secure_url,
      type,
    }, { transaction });

    // 4. Логируем добавление фото (вне транзакции)
    if (userId) {
      Promise.resolve(
          RequestLogger.logPhotoAdded(
              requestId,
              userId,
              type,
              req ? RequestLogger.getIpAddress(req) : null,
              req ? RequestLogger.getUserAgent(req) : null
          )
      ).catch(err => logger.error('Ошибка при логировании добавления фото', { error: err?.message }));
    }

    return photo;
  }
}

export default RequestPhotoService
