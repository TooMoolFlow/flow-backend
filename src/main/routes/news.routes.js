import express from 'express';
import NewsController from '../controllers/news.controller.js';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth.middleware.js';
import { commonUpload } from '../utils/multerUpload.js';

const router = express.Router();

// Публичные новости (без обязательной авторизации; при наличии токена — my_reaction)
router.get('/main', optionalAuthenticateToken, NewsController.getMainNews);
router.get('/all', optionalAuthenticateToken, NewsController.getAllNews);

router.post('/:id/view', authenticateToken, NewsController.recordNewsView);
router.put('/:id/reaction', authenticateToken, NewsController.setNewsReaction);

router.get('/:id', optionalAuthenticateToken, NewsController.getNewsById);

// Админские операции
router.post(
    '/',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    commonUpload.single('image'),
    NewsController.createNews,
);

router.get(
    '/admin/list',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    NewsController.getAdminNews,
);

router.patch(
    '/admin/:id',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    commonUpload.single('image'),
    NewsController.updateNews,
);

router.delete(
    '/admin/:id',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    NewsController.deleteNews,
);

router.patch(
    '/admin/:id/hide',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    NewsController.hideNews,
);

router.patch(
    '/admin/:id/archive',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    NewsController.archiveNews,
);

router.patch(
    '/admin/:id/unhide',
    authenticateToken,
    authorizeRoles('admin-worker', 'manager'),
    NewsController.unhideNews,
);

export default router;
