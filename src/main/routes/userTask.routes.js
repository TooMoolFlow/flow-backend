import express from 'express';

import UserTaskController from '../controllers/userTask.controller.js';
import { authenticateToken, forbidRoles } from '../middleware/auth.middleware.js';
import { commonUpload } from '../utils/multerUpload.js';

const router = express.Router();

const authNoManager = [authenticateToken, forbidRoles('manager')];

// list + create
router.get('/', ...authNoManager, UserTaskController.list);
router.post('/', ...authNoManager, UserTaskController.create);

// stats + calendar
router.get('/today-stats', ...authNoManager, UserTaskController.todayStats);
router.get('/calendar', ...authNoManager, UserTaskController.calendar);

// CRUD by id
router.get('/:id', ...authNoManager, UserTaskController.getById);
router.patch('/:id', ...authNoManager, UserTaskController.update);
router.put('/:id', ...authNoManager, UserTaskController.update);
router.patch('/:id/complete', ...authNoManager, UserTaskController.complete);
router.patch('/:id/remind', ...authNoManager, UserTaskController.remind);
router.delete('/:id', ...authNoManager, UserTaskController.remove);

// Attachments
router.get('/:id/attachments', ...authNoManager, UserTaskController.listAttachments);
router.post('/:id/attachments', ...authNoManager, commonUpload.array('files', 10), UserTaskController.uploadAttachments);
router.delete(
  '/:id/attachments/:attachmentId',
  ...authNoManager,
  UserTaskController.deleteAttachment
);

export default router;
