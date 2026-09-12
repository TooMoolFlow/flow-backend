import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import NewsService from '../services/news.service.js';

class NewsController {
    static createNews = asyncHandler(async (req, res) => {
        const { title, content, notification_type, publish_mode, published_at } = req.body;
        const file = req.file || null;

        const news = await NewsService.createNews({
            title,
            content,
            notificationType: notification_type,
            file,
            user: req.user,
            publishMode: publish_mode,
            publishedAt: published_at,
        });

        res.status(201).json(news);
    });

    static updateNews = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const { title, content, notification_type, publish_mode, published_at } = req.body;
        const file = req.file || null;

        const news = await NewsService.updateNews({
            id,
            title,
            content,
            notificationType: notification_type,
            file,
            publishMode: publish_mode,
            publishedAt: published_at,
        });

        res.json(news);
    });

    static deleteNews = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        await NewsService.deleteNews({ id, user: req.user });
        res.status(204).send();
    });

    static getMainNews = asyncHandler(async (req, res) => {
        const list = await NewsService.getMainNews();
        const news = await NewsService.attachEngagement(list, req.user?.id ?? null);
        res.json({ news });
    });

    static getAllNews = asyncHandler(async (req, res) => {
        const list = await NewsService.getAllPublicNews();
        const news = await NewsService.attachEngagement(list, req.user?.id ?? null);
        res.json({ news });
    });

    static getNewsById = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const item = await NewsService.getNewsByIdPublic(id);
        const [merged] = await NewsService.attachEngagement([item], req.user?.id ?? null);
        res.json(merged);
    });

    static getAdminNews = asyncHandler(async (req, res) => {
        const { status } = req.query;
        const list = await NewsService.getAdminNewsList({
            status: status || null,
            user: req.user,
        });
        const news = await NewsService.attachEngagement(list, null);
        res.json({ news });
    });

    static recordNewsView = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        await NewsService.recordView(id, req.user.id);
        res.status(204).send();
    });

    static setNewsReaction = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const { reaction } = req.body;
        const merged = await NewsService.setReaction(id, req.user.id, reaction);
        res.json(merged);
    });

    static hideNews = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const news = await NewsService.updateStatus({
            id,
            status: 'hidden',
            user: req.user,
        });
        res.json(news);
    });

    static archiveNews = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const news = await NewsService.updateStatus({
            id,
            status: 'archived',
            user: req.user,
        });
        res.json(news);
    });

    static unhideNews = asyncHandler(async (req, res) => {
        const id = parseInt(req.params.id, 10);
        const news = await NewsService.updateStatus({
            id,
            status: 'active',
            user: req.user,
        });
        res.json(news);
    });
}

export default NewsController;

