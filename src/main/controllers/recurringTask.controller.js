import RecurringTaskService from '../services/recurringTask.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import RecurringTaskDto from '../dto/recurringTask.dto.js';
import { BadRequestError } from '../errors/errors.js';

class RecurringTaskController {

    static createRecurringTask = asyncHandler(async (req, res) => {
        if (!req.body.recurrence_type) {
            throw new BadRequestError('recurrence_type is required for recurring tasks');
        }
        if (!['daily', 'weekly', 'monthly', 'yearly'].includes(req.body.recurrence_type)) {
            throw new BadRequestError('Invalid recurrence_type. Must be one of: daily, weekly, monthly, yearly');
        }
        const newTask = await RecurringTaskService.createRecurringTask(req.body, req.user);
        res.status(201).json(RecurringTaskDto.toResponse(newTask));
    });

    static importRecurringTasksFromExcel = asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new BadRequestError('Excel file is required');
        }
        const result = await RecurringTaskService.importRecurringTasksFromExcel(req.file, req.user);
        res.status(200).json({ message: 'Import completed successfully', ...result });
    });

    // Получение всех повторяющихся задач
    static getAllRecurringTasks = asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        const result = await RecurringTaskService.getAllRecurringTasks(page, pageSize, req.user);
        
        res.json(RecurringTaskDto.toListResponse(result));
    });

    // Получение экземпляров задачи
    static getTaskInstances = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        const result = await RecurringTaskService.getTaskInstances(requestGroupId, page, pageSize);
        res.json(RecurringTaskDto.toInstanceListResponse(result));
    });

    // Отметка экземпляра задачи как выполненной
    static completeTaskInstance = asyncHandler(async (req, res) => {
        const instanceId = parseInt(req.params.instanceId);
        const { notes } = req.body;

        const completedInstance = await RecurringTaskService.completeTaskInstance(
            instanceId,
            req.user.id,
            notes
        );

        res.json(RecurringTaskDto.toInstanceResponse(completedInstance));
    });

    // Пропуск экземпляра задачи
    static skipTaskInstance = asyncHandler(async (req, res) => {
        const instanceId = parseInt(req.params.instanceId);
        const { notes } = req.body;

        const skippedInstance = await RecurringTaskService.skipTaskInstance(
            instanceId,
            req.user.id,
            notes
        );

        res.json(RecurringTaskDto.toInstanceResponse(skippedInstance));
    });

    static assignExecutor = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId, 10);
        const { executor_id } = req.body;
        if (!executor_id) {
            throw new BadRequestError('executor_id is required');
        }
        const updatedTask = await RecurringTaskService.assignExecutor(requestGroupId, executor_id);
        res.json(RecurringTaskDto.toResponse(updatedTask));
    });

    static changeExecutor = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId, 10);
        const { executor_id } = req.body;
        if (!executor_id) {
            throw new BadRequestError('executor_id is required');
        }
        const updatedTask = await RecurringTaskService.changeExecutor(requestGroupId, executor_id);
        res.json(RecurringTaskDto.toResponse(updatedTask));
    });

    static toggleRecurringTask = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId, 10);
        const { action } = req.body;
        if (!['pause', 'resume'].includes(action)) {
            throw new BadRequestError("Invalid action. Use 'pause' or 'resume'.");
        }
        const updatedTask = await RecurringTaskService.toggleRecurringTask(requestGroupId, action);
        res.json(RecurringTaskDto.toResponse(updatedTask));
    });

    static updateRecurringTaskStatus = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId, 10);
        const { recurring_status } = req.body;
        if (!recurring_status) {
            throw new BadRequestError('recurring_status is required');
        }
        const updatedTask = await RecurringTaskService.updateRecurringTaskStatus(requestGroupId, recurring_status);
        res.json(RecurringTaskDto.toResponse(updatedTask));
    });

    // Получение статистики повторяющейся задачи
    static getTaskStats = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId);

        const stats = await RecurringTaskService.getTaskStats(requestGroupId);
        res.json(RecurringTaskDto.toStatsResponse(stats));
    });

    // Получение предстоящих задач
    static getUpcomingTasks = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;

        const upcomingTasks = await RecurringTaskService.getUpcomingTasks(req.user.id, limit);
        res.json(RecurringTaskDto.toCalendarResponse(upcomingTasks));
    });

    static getRecurringTaskById = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId, 10);
        const task = await RecurringTaskService.getRecurringTaskById(requestGroupId);
        res.json(RecurringTaskDto.toResponse(task));
    });

    // Обновление повторяющейся задачи
    static updateRecurringTask = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId);
        const updateData = req.body;

        const updatedTask = await RecurringTaskService.updateRecurringTask(requestGroupId, updateData);
        res.json(RecurringTaskDto.toResponse(updatedTask));
    });

    static deleteRecurringTask = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId, 10);
        await RecurringTaskService.deleteRecurringTask(requestGroupId);
        res.status(204).send();
    });

    // Получение календаря повторяющихся задач
    static getRecurringTaskCalendar = asyncHandler(async (req, res) => {
        const { start_date, end_date } = req.query;
        const startDate = start_date ? new Date(start_date) : new Date();
        const endDate = end_date ? new Date(end_date) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        const calendar = await RecurringTaskService.getRecurringTaskCalendar(
            req.user.id,
            startDate,
            endDate
        );

        res.json(RecurringTaskDto.toCalendarResponse(calendar));
    });

    // Ручное создание экземпляров для конкретной задачи
    static createInstancesForTask = asyncHandler(async (req, res) => {
        const requestGroupId = parseInt(req.params.requestGroupId);
        
        const instancesCreated = await RecurringTaskService.createInstancesForTask(requestGroupId);
        
        res.json({
            message: `Created ${instancesCreated} instances for task ${requestGroupId}`,
            instancesCreated
        });
    });

    // Ручной запуск создания экземпляров для всех задач
    static createAllInstances = asyncHandler(async (req, res) => {
        await RecurringTaskService.createTaskInstances();
        
        res.json({
            message: "Created instances for all recurring tasks"
        });
    });
}

export default RecurringTaskController;
