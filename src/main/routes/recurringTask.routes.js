import express from 'express';
import RecurringTaskController from '../controllers/recurringTask.controller.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Настройка multer для загрузки Excel файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'tmp/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'excel-import-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Проверяем расширение файла
        const allowedExtensions = ['.xlsx', '.xls'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

router.use(authenticateToken);

// Создание повторяющейся задачи (только admin-worker, department-head)
router.post('/', authorizeRoles('admin-worker', 'department-head'), RecurringTaskController.createRecurringTask);

// Импорт повторяющихся задач через Excel
router.post('/import-excel', authorizeRoles('admin-worker', 'department-head'), upload.single('excelFile'), RecurringTaskController.importRecurringTasksFromExcel);

// Получение всех повторяющихся задач
router.get('/', RecurringTaskController.getAllRecurringTasks);

// Получение предстоящих задач
router.get('/upcoming', RecurringTaskController.getUpcomingTasks);

// Получение календаря повторяющихся задач
router.get('/calendar', RecurringTaskController.getRecurringTaskCalendar);

// Получение детальной информации о повторяющейся задаче
router.get('/:requestGroupId', RecurringTaskController.getRecurringTaskById);

// Обновление повторяющейся задачи
router.put('/:requestGroupId', RecurringTaskController.updateRecurringTask);

// Удаление повторяющейся задачи
router.delete('/:requestGroupId', RecurringTaskController.deleteRecurringTask);

// Приостановка/возобновление повторяющейся задачи
router.patch('/:requestGroupId/toggle', RecurringTaskController.toggleRecurringTask);

// Обновление статуса повторяющейся задачи
router.patch('/:requestGroupId/status', RecurringTaskController.updateRecurringTaskStatus);

// Получение статистики повторяющейся задачи
router.get('/:requestGroupId/stats', RecurringTaskController.getTaskStats);

// Получение экземпляров задачи
router.get('/:requestGroupId/instances', RecurringTaskController.getTaskInstances);

// Ручное создание экземпляров для конкретной задачи
router.post('/:requestGroupId/create-instances', RecurringTaskController.createInstancesForTask);

// Ручной запуск создания экземпляров для всех задач
router.post('/create-all-instances', RecurringTaskController.createAllInstances);

// Отметка экземпляра задачи как выполненной
router.patch('/instances/:instanceId/complete', RecurringTaskController.completeTaskInstance);

// Пропуск экземпляра задачи
router.patch('/instances/:instanceId/skip', RecurringTaskController.skipTaskInstance);

// Назначение исполнителя (только department-head)
router.patch('/:requestGroupId/assign-executor', authorizeRoles('department-head'), RecurringTaskController.assignExecutor);

// Изменение исполнителя (только department-head)
router.patch('/:requestGroupId/change-executor', authorizeRoles('department-head'), RecurringTaskController.changeExecutor);

export default router;
