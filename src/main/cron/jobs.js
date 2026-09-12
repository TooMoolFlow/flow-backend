import * as cron from 'node-cron';
import logger from '../utils/winston/logger.js';
import RecurringTaskService from '../services/recurringTask.service.js';
import PhotoCleaner from '../services/photoCleaner.service.js';
import MeetingRoomBookingService from '../services/meetingRoomBooking.service.js';
import * as StepsService from '../services/steps.service.js';
import UserTaskReminderService from '../services/userTaskReminder.service.js';
import { User } from '../models/init.model.js';
import HealthyInsightEngineService from '../services/healthy/healthy-insight-engine.service.js';
import HealthyOpsService from '../services/healthy/healthy-ops.service.js';
import NewsService from '../services/news.service.js';

/** Централизованная обёртка: выполняет задачу, при ошибке логирует и не пробрасывает. */
async function runCronJob(name, fn) {
  try {
    await fn();
  } catch (error) {
    logger.error(`Cron: ${name}`, { error: error?.message, stack: error?.stack });
  }
}

/**
 * Register all scheduled cron jobs.
 */
export function startCronJobs() {
  cron.schedule('0 0 * * *', () =>
    runCronJob('recurring-tasks', async () => {
      logger.info('Проверка экземпляров повторяющихся задач...');
      await RecurringTaskService.reconcileAndCreateAll();
      await RecurringTaskService.activatePendingTasks();
      logger.info('Экземпляры повторяющихся задач проверены успешно');
    })
  );

  cron.schedule('*/30 * * * *', () =>
    runCronJob('photo-cleaner', async () => {
      if (process.env.NODE_ENV !== 'production') return;
      logger.info('Запуск очистки висячих фото...');
      await PhotoCleaner.cleanOrphanPhotos();
    })
  );

  cron.schedule('*/5 * * * *', () =>
    runCronJob('complete-expired-bookings', async () => {
      const result = await MeetingRoomBookingService.completeExpiredBookings();
      if (result.completed > 0) {
        logger.info(`Автоматически завершено ${result.completed} бронирований переговорных комнат`);
      }
    })
  );

  cron.schedule('*/5 * * * *', () =>
    runCronJob('start-in-progress-bookings', async () => {
      const result = await MeetingRoomBookingService.startInProgressBookings();
      if (result.started > 0) {
        logger.info(`Запущено ${result.started} бронирований переговорных комнат (in_progress)`);
      }
    })
  );

  cron.schedule('*/5 * * * *', () =>
    runCronJob('booking-reminders', async () => {
      const result = await MeetingRoomBookingService.sendBookingReminders();
      if (result.remindersSent > 0) {
        logger.info(`Отправлено ${result.remindersSent} напоминаний о бронированиях`);
      }
    })
  );

  cron.schedule('*/15 * * * *', () =>
    runCronJob('step-notifications', () => StepsService.processStepNotifications())
  );

  cron.schedule('15 * * * *', () =>
    runCronJob('healthy-insight-refresh', async () => {
      const users = await User.findAll({ attributes: ['id', 'role'] });
      for (const user of users) {
        if (user.role !== 'client') continue;
        try {
          await HealthyInsightEngineService.generateForUser(user.id, 'day');
          await HealthyInsightEngineService.generateForUser(user.id, 'week');
          await HealthyInsightEngineService.generateForUser(user.id, 'month');
        } catch (error) {
          logger.error('Healthy cron user generation failed', {
            userId: user.id,
            error: error?.message,
          });
        }
      }
    })
  );

  cron.schedule('10 3 * * *', () =>
    runCronJob('healthy-log-retention', () => HealthyOpsService.cleanupGenerationLogs())
  );

  // User task reminders (push)
  cron.schedule('* * * * *', () =>
    runCronJob('user-task-reminders', async () => {
      const result = await UserTaskReminderService.sendDueReminders();
      if (result.remindersSent > 0) {
        logger.info(`Отправлено ${result.remindersSent} напоминаний по задачам`);
      }
    })
  );

  cron.schedule('* * * * *', () =>
    runCronJob('news-scheduled-publish', async () => {
      const result = await NewsService.publishDueScheduledNews();
      if (result.published > 0) {
        logger.info(`Опубликовано отложенных новостей: ${result.published}`);
      }
    })
  );

  logger.info('Cron jobs registered');
}
