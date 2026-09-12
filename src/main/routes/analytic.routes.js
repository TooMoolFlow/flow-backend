import express from "express";
import {authorizeRoles} from "../middleware/auth.middleware.js";
import AnalyticController from "../controllers/analytic.controller.js";

const router = express.Router();

router.get("/export", authorizeRoles("manager", "admin"), AnalyticController.exportAnalytics);

router.get('/stats/client', authorizeRoles('client'), AnalyticController.getClientStats);
router.get('/stats/admin-worker', authorizeRoles('admin-worker'), AnalyticController.getAdminWorkerStats);
router.get('/stats/department-head', authorizeRoles('department-head'), AnalyticController.getDepartmentHeadStats);
router.get('/stats/executor', authorizeRoles('executor'), AnalyticController.getExecutorStats);
// Разрешаем доступ админу для получения статистики по офисам (данные фильтруются на фронтенде по office_id)
router.get('/stats/manager', authorizeRoles('manager', 'admin-worker'), AnalyticController.getManagerStats);

// Новые маршруты для детальной аналитики менеджера
router.get('/stats/manager/sla', authorizeRoles('manager', 'admin-worker'), AnalyticController.getManagerSLAStats);
router.get('/stats/manager/ratings', authorizeRoles('manager', 'admin-worker'), AnalyticController.getManagerRatingStats);
router.get('/stats/manager/detailed', authorizeRoles('manager', 'admin-worker'), AnalyticController.getManagerDetailedStats);

export default router;