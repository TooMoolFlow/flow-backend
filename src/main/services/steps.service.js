import { Op } from 'sequelize';
import { UserStepsDaily, User, Office } from '../models/init.model.js';
import FCMService from './fcm.service.js';
import logger from '../utils/winston/logger.js';

const DEFAULT_START = '08:00:00';
const DEFAULT_END = '18:00:00';
const ALMOST_GOAL_MIN = 0.75;
const ALMOST_GOAL_MAX = 0.9;
const MAX_NO_ACTIVITY_PER_DAY = 3;

/**
 * Проверка: текущее время в рабочем интервале офиса
 */
function isWithinWorkingHours(startStr, endStr) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = (startStr || DEFAULT_START).toString().split(':').map(Number);
    const [endH, endM] = (endStr || DEFAULT_END).toString().split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Синхронизация шагов с приложения (вызывается при открытии приложения / периодически)
 */
export async function syncSteps(userId, payload) {
    const { stepsToday, goalSteps, noActivityIntervalHours, stepsNotificationsEnabled } = payload;
    const date = new Date().toISOString().slice(0, 10);

    const [row, created] = await UserStepsDaily.findOrCreate({
        where: { user_id: userId, date },
        defaults: {
            user_id: userId,
            date,
            steps_today: Math.max(0, Number(stepsToday) || 0),
            goal_steps: goalSteps != null ? Math.max(0, Number(goalSteps)) : null,
            no_activity_interval_hours: Math.max(1, Math.min(3, Number(noActivityIntervalHours) || 2)),
            steps_notifications_enabled: stepsNotificationsEnabled !== false,
            last_steps_value: Math.max(0, Number(stepsToday) || 0),
            last_steps_at: new Date(),
        },
    });

    if (!created) {
        await row.update({
            steps_today: Math.max(0, stepsToday != null ? Number(stepsToday) : row.steps_today),
            goal_steps: goalSteps != null ? Math.max(0, Number(goalSteps)) : row.goal_steps,
            no_activity_interval_hours: noActivityIntervalHours != null
                ? Math.max(1, Math.min(3, Number(noActivityIntervalHours)))
                : row.no_activity_interval_hours,
            steps_notifications_enabled: stepsNotificationsEnabled !== undefined ? stepsNotificationsEnabled !== false : row.steps_notifications_enabled,
            last_steps_value: Math.max(0, stepsToday != null ? Number(stepsToday) : row.steps_today),
            last_steps_at: new Date(),
        });
    }

    return { success: true, date };
}

/**
 * Обработка пуш-уведомлений шагомера: 50% цели, почти цель, нет активности.
 * Вызывается по крону каждые 5–15 минут.
 */
export async function processStepNotifications() {
    const date = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const rows = await UserStepsDaily.findAll({
        where: {
            date,
            steps_notifications_enabled: true,
            goal_steps: { [Op.gt]: 0 },
        },
    });

    let sent50 = 0;
    let sentAlmost = 0;
    let sentNoActivity = 0;

    for (const row of rows) {
        const user = await User.findByPk(row.user_id, { include: [{ model: Office, as: 'office' }] });
        if (!user || user.role !== 'client' || !user.office_id) continue;

        const office = user.office;
        const startStr = office?.working_hours_start ? String(office.working_hours_start).slice(0, 8) : DEFAULT_START;
        const endStr = office?.working_hours_end ? String(office.working_hours_end).slice(0, 8) : DEFAULT_END;
        if (!isWithinWorkingHours(startStr, endStr)) continue;

        const steps = row.steps_today;
        const goal = row.goal_steps;
        if (goal <= 0) continue;

        const ratio = steps / goal;

        // 50% цели — один раз в день
        if (!row.fifty_sent_at && ratio >= 0.5) {
            const result = await FCMService.sendToUser(row.user_id, 'Шаги — 50% цели',
                `Вы прошли половину дневной цели: ${steps.toLocaleString('ru-RU')} из ${goal.toLocaleString('ru-RU')} шагов.`,
                { type: 'steps', event: '50_percent' });
            if (result.success) {
                await row.update({ fifty_sent_at: now });
                sent50++;
            }
        }

        // Почти цель (75–90%) — один раз в день
        if (!row.almost_goal_sent_at && ratio >= ALMOST_GOAL_MIN && ratio <= ALMOST_GOAL_MAX) {
            const result = await FCMService.sendToUser(row.user_id, 'Шаги — почти цель',
                `Осталось немного до цели: ${steps.toLocaleString('ru-RU')} из ${goal.toLocaleString('ru-RU')} шагов.`,
                { type: 'steps', event: 'almost_goal' });
            if (result.success) {
                await row.update({ almost_goal_sent_at: now });
                sentAlmost++;
            }
        }

        // Нет активности: шаги не росли в течение no_activity_interval_hours, макс 3 раза в день
        const noActivityHours = row.no_activity_interval_hours || 2;
        const intervalMs = noActivityHours * 60 * 60 * 1000;
        const lastAt = row.last_steps_at ? new Date(row.last_steps_at).getTime() : 0;
        const noActivityCount = row.no_activity_count || 0;

        if (noActivityCount < MAX_NO_ACTIVITY_PER_DAY && lastAt > 0 && (now.getTime() - lastAt) >= intervalMs && steps <= row.last_steps_value) {
            const result = await FCMService.sendToUser(row.user_id, 'Шаги — нет активности',
                `За последние ${noActivityHours} ч шаги не изменились. Пора размяться?`,
                { type: 'steps', event: 'no_activity' });
            if (result.success) {
                await row.update({
                    no_activity_count: noActivityCount + 1,
                    no_activity_last_sent_at: now,
                });
                sentNoActivity++;
            }
        }
    }

    if (sent50 + sentAlmost + sentNoActivity > 0) {
        logger.info(`Шагомер: отправлено пушей — 50%: ${sent50}, почти цель: ${sentAlmost}, нет активности: ${sentNoActivity}`);
    }
    return { sent50, sentAlmost, sentNoActivity };
}
