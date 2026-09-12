import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import UserTaskService from '../services/userTask.service.js';

class UserTaskController {
  static list = asyncHandler(async (req, res) => {
    const result = await UserTaskService.list(req.user.id, req.query);
    res.json(result);
  });

  static getById = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const task = await UserTaskService.getById(req.user.id, taskId);
    res.json({ task });
  });

  static create = asyncHandler(async (req, res) => {
    const task = await UserTaskService.create(req.user.id, req.body);
    res.status(201).json({ task });
  });

  static update = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const task = await UserTaskService.update(req.user.id, taskId, req.body);
    res.json({ task });
  });

  static remove = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    await UserTaskService.remove(req.user.id, taskId);
    res.status(204).send();
  });

  static todayStats = asyncHandler(async (req, res) => {
    const stats = await UserTaskService.getTodayStats(req.user.id);
    res.json(stats);
  });

  static calendar = asyncHandler(async (req, res) => {
    const result = await UserTaskService.getCalendar(req.user.id, req.query);
    res.json(result);
  });

  static complete = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const completed = typeof req.body?.completed === 'boolean' ? req.body.completed : true;
    const task = await UserTaskService.update(req.user.id, taskId, { completed });
    res.json({ task });
  });

  static remind = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const { action } = req.body || {};
    const task = await UserTaskService.applyReminderAction(req.user.id, taskId, action);
    res.json({ task });
  });

  static listAttachments = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const attachments = await UserTaskService.listAttachments(req.user.id, taskId);
    res.json({ attachments });
  });

  static uploadAttachments = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = await UserTaskService.uploadAttachments(req.user.id, taskId, files, req);
    res.status(201).json({ attachments });
  });

  static deleteAttachment = asyncHandler(async (req, res) => {
    const taskId = parseInt(req.params.id, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);
    await UserTaskService.deleteAttachment(req.user.id, taskId, attachmentId);
    res.status(204).send();
  });
}

export default UserTaskController;
