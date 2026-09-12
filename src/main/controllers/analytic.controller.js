import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import AnalyticService from '../services/analytic.service.js';
import StatisticsService from '../services/statistics.service.js';

class AnalyticController {

    static exportAnalytics = asyncHandler(async (req, res) => {
        const { format = 'xlsx' } = req.query;
        const filters = AnalyticService.buildExportFilters(req.query);
        const buffer = await AnalyticService.getExcelAnalytics(filters);
        
        if (format === 'xlsx') {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=analytics.xlsx');
            return res.send(buffer);
        }
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const tempDir = os.tmpdir();
        const filePath = path.join(tempDir, 'analytics.xlsx');
        await fs.promises.writeFile(filePath, buffer);

        // Возвращаем Power BI шаблон (предварительно загруженный)
        const templatePath = path.resolve('src/main/assets/workflow.pbix'); // положи туда шаблон
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename=analytics_template.pbix');
        return res.sendFile(templatePath);
    });

    static getClientStats = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const data = await StatisticsService.getClientStats(userId);
        res.json(data);
    });

    static getAdminWorkerStats = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const data = await StatisticsService.getAdminWorkerStats(userId);
        res.json(data);
    });

    static getDepartmentHeadStats = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const data = await StatisticsService.getDepartmentHeadStats(userId);
        res.json(data);
    });

    static getExecutorStats = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const data = await StatisticsService.getExecutorStats(userId);
        res.json(data);
    });

    static getManagerStats = asyncHandler(async (req, res) => {
        const data = await StatisticsService.getManagerStats();
        res.json(data);
    });

    static getManagerSLAStats = asyncHandler(async (req, res) => {
        const data = await StatisticsService.getSLAStats();
        res.json(data);
    });

    static getManagerRatingStats = asyncHandler(async (req, res) => {
        const data = await StatisticsService.getRatingStats();
        res.json(data);
    });

    static getManagerDetailedStats = asyncHandler(async (req, res) => {
        const data = await StatisticsService.getDetailedStats();
        res.json(data);
    });
}

export default AnalyticController;