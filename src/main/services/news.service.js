import fs from 'fs/promises';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.config.js';
import { News, NewsReaction, NewsView } from '../models/init.model.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';
import NotificationService from './notification.service.js';

const NOTIFICATION_TYPES = ['none', 'push_sound', 'push_silent'];

/** Допустимое отставание клиента/сервера при проверке «в будущем» (мс). */
const SCHEDULE_MIN_LEAD_MS = 60_000;

/** Не дальше чем через 365 суток от текущего момента. */
const SCHEDULE_MAX_LEAD_MS = 365 * 24 * 60 * 60 * 1000;

class NewsService {

    static emptyReactionCounts() {
        return { thumb: 0, heart: 0, eyes: 0, fire: 0 };
    }

    static async buildEngagementMap(newsIds, userId) {
        const map = new Map();
        for (const id of newsIds) {
            map.set(id, {
                view_count: 0,
                reaction_counts: this.emptyReactionCounts(),
                my_reaction: null,
            });
        }
        if (!newsIds.length) {
            return map;
        }

        const viewRows = await sequelize.query(
            `SELECT news_id, COUNT(*)::int AS cnt FROM news_views WHERE news_id IN (:ids) GROUP BY news_id`,
            { replacements: { ids: newsIds }, type: QueryTypes.SELECT },
        );
        for (const row of viewRows) {
            const e = map.get(row.news_id);
            if (e) {
                e.view_count = Number(row.cnt) || 0;
            }
        }

        const reactRows = await sequelize.query(
            `SELECT news_id, reaction, COUNT(*)::int AS cnt FROM news_reactions
             WHERE news_id IN (:ids) GROUP BY news_id, reaction`,
            { replacements: { ids: newsIds }, type: QueryTypes.SELECT },
        );
        for (const row of reactRows) {
            const e = map.get(row.news_id);
            if (e && Object.prototype.hasOwnProperty.call(e.reaction_counts, row.reaction)) {
                e.reaction_counts[row.reaction] = Number(row.cnt) || 0;
            }
        }

        if (userId) {
            const mine = await sequelize.query(
                `SELECT news_id, reaction FROM news_reactions WHERE user_id = :uid AND news_id IN (:ids)`,
                { replacements: { uid: userId, ids: newsIds }, type: QueryTypes.SELECT },
            );
            for (const row of mine) {
                const e = map.get(row.news_id);
                if (e) {
                    e.my_reaction = row.reaction;
                }
            }
        }

        return map;
    }

    static newsToPublicJson(newsInstance, engagementMap) {
        const j = typeof newsInstance.toJSON === 'function' ? newsInstance.toJSON() : { ...newsInstance };
        const e = engagementMap.get(j.id) || {
            view_count: 0,
            reaction_counts: this.emptyReactionCounts(),
            my_reaction: null,
        };
        return {
            ...j,
            view_count: e.view_count,
            reaction_counts: e.reaction_counts,
            my_reaction: e.my_reaction,
        };
    }

    static async attachEngagement(rows, userId) {
        const ids = rows.map((r) => r.id);
        const map = await this.buildEngagementMap(ids, userId);
        return rows.map((r) => this.newsToPublicJson(r, map));
    }

    static async recordView(newsId, userId) {
        const news = await News.findByPk(newsId);
        if (!news || news.status === 'archived' || news.status === 'scheduled') {
            throw new NotFoundError('Новость не найдена');
        }
        await NewsView.findOrCreate({
            where: { news_id: newsId, user_id: userId },
            defaults: { viewed_at: new Date() },
        });
    }

    static async setReaction(newsId, userId, reactionRaw) {
        const allowed = ['thumb', 'heart', 'eyes', 'fire'];
        const reaction = String(reactionRaw || '').trim();
        if (!allowed.includes(reaction)) {
            throw new BadRequestError('Некорректная реакция');
        }
        const news = await News.findByPk(newsId);
        if (!news || news.status === 'archived' || news.status === 'scheduled') {
            throw new NotFoundError('Новость не найдена');
        }
        const existing = await NewsReaction.findOne({ where: { news_id: newsId, user_id: userId } });
        if (existing) {
            existing.reaction = reaction;
            existing.updated_at = new Date();
            await existing.save();
        } else {
            await NewsReaction.create({
                news_id: newsId,
                user_id: userId,
                reaction,
                created_at: new Date(),
                updated_at: new Date(),
            });
        }
        const fresh = await News.findByPk(newsId);
        const [merged] = await this.attachEngagement([fresh], userId);
        return merged;
    }

    static normalizeNotificationType(notificationType) {
        const normalizedType = notificationType || 'none';
        if (!NOTIFICATION_TYPES.includes(normalizedType)) {
            throw new BadRequestError('Неверный тип уведомления');
        }
        return normalizedType;
    }

    static parseSchedulePublishAt(publishedAtRaw) {
        if (publishedAtRaw == null || String(publishedAtRaw).trim() === '') {
            throw new BadRequestError('Укажите дату и время публикации');
        }
        const d = new Date(publishedAtRaw);
        if (Number.isNaN(d.getTime())) {
            throw new BadRequestError('Некорректная дата публикации');
        }
        const minTime = Date.now() - SCHEDULE_MIN_LEAD_MS;
        if (d.getTime() < minTime) {
            throw new BadRequestError('Время публикации должно быть в будущем');
        }
        const maxTime = Date.now() + SCHEDULE_MAX_LEAD_MS;
        if (d.getTime() > maxTime) {
            throw new BadRequestError('Время публикации не может быть позже чем через год');
        }
        return d;
    }

    static parsePublishMode(raw) {
        const v = (raw || 'now').toString().trim().toLowerCase();
        if (v === 'now' || v === 'schedule') {
            return v;
        }
        throw new BadRequestError('Некорректный режим публикации');
    }

    static async uploadImage(file) {
        if (!file) {
            return null;
        }

        let result;
        try {
            result = await uploadToCloudinary(file.path, { folder: 'news' });
        } catch (err) {
            const msg = (err.message || '').toLowerCase();
            if (msg.includes('file size too large') || msg.includes('maximum is')) {
                throw new BadRequestError(
                    'Размер фотографии превышает допустимый лимит (10 МБ). Пожалуйста, выберите фото меньшего размера или сожмите изображение.',
                );
            }
            throw err;
        } finally {
            await fs.unlink(file.path).catch(() => {});
        }

        return result.secure_url;
    }

    static async createNews({
        title,
        content,
        notificationType,
        file,
        user,
        publishMode: publishModeRaw,
        publishedAt: publishedAtRaw,
    }) {
        if (!title || !title.trim()) {
            throw new BadRequestError('Заголовок обязателен');
        }
        if (!content || !content.trim()) {
            throw new BadRequestError('Текст обязателен');
        }

        const normalizedType = this.normalizeNotificationType(notificationType);
        const publishMode = this.parsePublishMode(publishModeRaw);

        const imageUrl = await this.uploadImage(file);

        let status;
        let publishedAt;
        let shouldNotifyNow = false;

        if (publishMode === 'schedule') {
            publishedAt = this.parseSchedulePublishAt(publishedAtRaw);
            status = 'scheduled';
            shouldNotifyNow = false;
        } else {
            publishedAt = new Date();
            status = 'active';
            shouldNotifyNow = true;
        }

        const news = await News.create({
            title: title.trim(),
            content: content.trim(),
            image_url: imageUrl,
            status,
            notification_type: normalizedType,
            published_at: publishedAt,
            created_by: user.id,
        });

        if (shouldNotifyNow) {
            await this.sendPublishNotificationIfNeeded(news);
        }

        return news;
    }

    static async updateNews({
        id,
        title,
        content,
        notificationType,
        file,
        publishMode: publishModeRaw,
        publishedAt: publishedAtRaw,
    }) {
        const news = await News.findByPk(id);
        if (!news) {
            throw new NotFoundError('Новость не найдена');
        }

        if (!title || !title.trim()) {
            throw new BadRequestError('Заголовок обязателен');
        }
        if (!content || !content.trim()) {
            throw new BadRequestError('Текст обязателен');
        }

        const normalizedType = this.normalizeNotificationType(notificationType);

        const imageUrl = await this.uploadImage(file);

        news.title = title.trim();
        news.content = content.trim();
        news.notification_type = normalizedType;
        if (imageUrl) {
            news.image_url = imageUrl;
        }
        news.updated_at = new Date();

        let shouldNotifyNow = false;

        if (news.status === 'scheduled') {
            const modeStr = publishModeRaw != null ? String(publishModeRaw).trim() : '';
            const publishMode =
                modeStr === '' ? 'schedule' : this.parsePublishMode(publishModeRaw);

            if (publishMode === 'now') {
                news.status = 'active';
                news.published_at = new Date();
                shouldNotifyNow = true;
            } else {
                const atStr = publishedAtRaw != null ? String(publishedAtRaw).trim() : '';
                if (atStr !== '') {
                    news.published_at = this.parseSchedulePublishAt(publishedAtRaw);
                }
                news.status = 'scheduled';
            }
        }

        await news.save();

        if (shouldNotifyNow) {
            await this.sendPublishNotificationIfNeeded(news);
        }

        return news;
    }

    static async deleteNews({ id }) {
        const news = await News.findByPk(id);
        if (!news) {
            throw new NotFoundError('Новость не найдена');
        }
        await news.destroy();
        return true;
    }

    static async sendPublishNotificationIfNeeded(newsInstance) {
        if (!newsInstance || newsInstance.notification_type === 'none') {
            return;
        }

        const title = newsInstance.title;
        const maxLength = 140;
        const body =
            (newsInstance.content || '').length > maxLength
                ? `${newsInstance.content.slice(0, maxLength)}…`
                : newsInstance.content || '';

        const data = {
            type: newsInstance.notification_type === 'push_sound' ? 'news_loud' : 'news_silent',
            newsId: newsInstance.id.toString(),
            timestamp: new Date().toISOString(),
        };

        await NotificationService.sendPushNotificationToAll(title, body, data);
    }

    static async getMainNews() {
        return News.findAll({
            where: { status: 'active' },
            order: [['published_at', 'DESC']],
        });
    }

    static async getAllPublicNews() {
        return News.findAll({
            where: { status: { [Op.in]: ['active', 'hidden'] } },
            order: [['published_at', 'DESC']],
        });
    }

    static async getNewsByIdPublic(id) {
        const news = await News.findByPk(id);
        if (!news || news.status === 'archived' || news.status === 'scheduled') {
            throw new NotFoundError('Новость не найдена');
        }
        return news;
    }

    static async getAdminNewsList({ status }) {
        const where = {};
        if (status) {
            if (!['active', 'hidden', 'archived', 'scheduled'].includes(status)) {
                throw new BadRequestError('Некорректный статус для фильтра');
            }
            where.status = status;
        }

        return News.findAll({
            where,
            order: [['published_at', 'DESC']],
        });
    }

    static async updateStatus({ id, status }) {
        if (!['active', 'hidden', 'archived'].includes(status)) {
            throw new BadRequestError('Некорректный статус новости');
        }

        const news = await News.findByPk(id);
        if (!news) {
            throw new NotFoundError('Новость не найдена');
        }

        if (status === 'active') {
            const publishedAt = news.published_at ? new Date(news.published_at) : null;
            const now = new Date();
            if (publishedAt && !Number.isNaN(publishedAt.getTime()) && publishedAt.getTime() > now.getTime()) {
                news.status = 'scheduled';
            } else {
                news.status = 'active';
            }
        } else {
            news.status = status;
        }

        news.updated_at = new Date();
        await news.save();

        return news;
    }

    /** Публикация новостей, у которых наступило время (cron). */
    static async publishDueScheduledNews() {
        const now = new Date();
        const due = await News.findAll({
            where: {
                status: 'scheduled',
                published_at: { [Op.lte]: now },
            },
        });

        let published = 0;
        for (const row of due) {
            row.status = 'active';
            row.updated_at = new Date();
            await row.save();
            await this.sendPublishNotificationIfNeeded(row);
            published += 1;
        }
        return { published };
    }
}

export default NewsService;
