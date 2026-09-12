import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import logger from './winston/logger.js';
import { BadRequestError } from '../errors/errors.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — Cloudinary free plan limit

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Сжимает изображение в WebP формат для уменьшения размера перед загрузкой в Cloudinary.
 * Если файл уже меньше лимита — возвращает исходный путь.
 */
async function compressToWebPIfNeeded(filePath) {
    const stats = fs.statSync(filePath);

    if (stats.size <= MAX_FILE_SIZE) {
        return filePath;
    }

    const ext = path.extname(filePath).toLowerCase();
    const allowedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    if (!allowedFormats.includes(ext)) {
        return filePath;
    }

    const compressedPath = filePath + '_compressed.webp';

    const ratio = MAX_FILE_SIZE / stats.size;
    let quality = Math.floor(ratio * 85);
    quality = Math.max(quality, 20);
    quality = Math.min(quality, 80);

    try {
        await sharp(filePath)
            .webp({ quality })
            .toFile(compressedPath);

        const compressedStats = fs.statSync(compressedPath);

        if (compressedStats.size > MAX_FILE_SIZE) {
            const secondRatio = MAX_FILE_SIZE / compressedStats.size;
            const secondQuality = Math.max(Math.floor(quality * secondRatio * 0.9), 10);

            const secondCompressedPath = filePath + '_compressed2.webp';
            await sharp(filePath)
                .resize({ width: 2048, withoutEnlargement: true })
                .webp({ quality: secondQuality })
                .toFile(secondCompressedPath);

            fs.unlinkSync(compressedPath);
            return secondCompressedPath;
        }

        return compressedPath;
    } catch (err) {
        logger.warn('Ошибка сжатия изображения', { message: err.message });
        return filePath;
    }
}

export async function uploadToCloudinary(filePath, options = {}) {
    const processedPath = await compressToWebPIfNeeded(filePath);

    try {
        const result = await cloudinary.uploader.upload(processedPath, {
            folder: options.folder || 'request_photos',
            ...options,
        });
        return result;
    } finally {
        if (processedPath !== filePath) {
            fs.unlink(processedPath, () => {});
        }
    }
}

/**
 * Загрузка base64-изображения (data URI) в Cloudinary.
 */
export async function uploadBase64ToCloudinary(base64Data, options = {}) {
    if (!process.env.CLOUDINARY_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        logger.warn('Cloudinary не настроен', {
            CLOUDINARY_NAME: !!process.env.CLOUDINARY_NAME,
            CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
            CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
        });
        throw new BadRequestError('Cloudinary не настроен. Проверьте переменные окружения.');
    }

    try {
        const result = await cloudinary.uploader.upload(base64Data, {
            folder: options.folder || 'office_photos',
            resource_type: 'image',
            public_id: options.publicId,
            overwrite: options.overwrite ?? Boolean(options.publicId),
        });
        return result.secure_url;
    } catch (error) {
        logger.error('Ошибка при загрузке фото в Cloudinary', {
            message: error.message,
            stack: error.stack,
            response: error.response,
        });
        throw new BadRequestError(`Не удалось загрузить фото в Cloudinary: ${error.message}`);
    }
}

/**
 * Загрузка изображения по внешнему URL в Cloudinary (для миграции).
 */
export async function uploadFromUrlToCloudinary(url, options = {}) {
    if (!url || typeof url !== 'string' || !url.trim()) {
        throw new BadRequestError('URL обязателен');
    }
    if (!process.env.CLOUDINARY_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        throw new BadRequestError('Cloudinary не настроен. Проверьте переменные окружения.');
    }
    const result = await cloudinary.uploader.upload(url, {
        folder: options.folder || 'uploads',
        resource_type: 'image',
        ...options,
    });
    return result.secure_url;
}

/**
 * Удаление изображения из Cloudinary по полному URL.
 */
export async function deleteFromCloudinaryByUrl(photoUrl) {
    try {
        if (!photoUrl || !photoUrl.includes('cloudinary.com')) return;

        const urlMatch = photoUrl.match(/\/upload\/(?:v\d+\/)?(.+)/);
        if (urlMatch && urlMatch[1]) {
            const pathWithExt = urlMatch[1];
            const publicId = pathWithExt.replace(/\.[^/.]+$/, '');

            if (publicId) {
                await cloudinary.uploader.destroy(publicId);
            }
        }
    } catch (error) {
        logger.warn('Ошибка при удалении фото из Cloudinary', { error: error?.message });
    }
}

export { cloudinary };
