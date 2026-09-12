/**
 * Recurrence helpers for user tasks. Date/time anchor uses Asia/Almaty (same as mobile).
 */

import { BadRequestError } from '../errors/errors.js';

const APP_TIMEZONE = 'Asia/Almaty';

const RECURRENCE_TYPES = new Set(['none', 'daily', 'weekly', 'weekdays', 'monthly', 'custom']);
const CUSTOM_UNITS = new Set(['day', 'week', 'month']);

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD in Almaty */
export function almatyDateKeyFromInstant(iso) {
  const d = toDate(iso);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

/** HH:mm in Almaty */
export function almatyTimeHmFromInstant(iso) {
  const d = toDate(iso);
  if (!d) return '09:00';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hh = parts.find((p) => p.type === 'hour')?.value ?? '09';
    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  } catch {
    return '09:00';
  }
}

function getAlmatyOffsetMinutes(utcDate) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcDate);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '0';
    const y = Number(get('year'));
    const m = Number(get('month'));
    const d = Number(get('day'));
    const hh = Number(get('hour'));
    const mm = Number(get('minute'));
    const ss = Number(get('second'));
    const asLocalMs = Date.UTC(y, m - 1, d, hh, mm, ss);
    return Math.round((asLocalMs - utcDate.getTime()) / 60000);
  } catch {
    return 5 * 60;
  }
}

/** UTC ISO from YYYY-MM-DD + HH:mm interpreted as Almaty */
export function utcIsoFromAlmatyDateKeyAndTime(dateKey, timeHm) {
  const [yS, mS, dS] = (dateKey || '').split('-');
  const [hhS, mmS] = (timeHm || '09:00').split(':');
  const y = Number(yS);
  const m = Number(mS);
  const d = Number(dS);
  const hh = Number(hhS);
  const mm = Number(mmS);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(hh) || !Number.isFinite(mm)) {
    return new Date().toISOString();
  }
  const asIfUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  const guessUtc = new Date(asIfUtcMs);
  const offsetMin = getAlmatyOffsetMinutes(guessUtc);
  const utcMs = asIfUtcMs - offsetMin * 60000;
  return new Date(utcMs).toISOString();
}

/** Monday=1 … Sunday=7 in Almaty */
function almatyMon1Sun7(iso) {
  const d = toDate(iso);
  if (!d) return 1;
  try {
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIMEZONE,
      weekday: 'short',
    }).format(d);
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[wd] ?? 1;
  } catch {
    const day = d.getUTCDay();
    return day === 0 ? 7 : day;
  }
}

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { y, m, d };
}

function addDaysToDateKey(dateKey, days) {
  const { y, m, d } = parseDateKey(dateKey);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Last day of month (month 1–12) */
function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function addMonthsKeepDayOrLast(dateKey, months) {
  const { y, m, d } = parseDateKey(dateKey);
  let ny = y;
  let nm = m + months;
  while (nm > 12) {
    nm -= 12;
    ny += 1;
  }
  while (nm < 1) {
    nm += 12;
    ny -= 1;
  }
  const dim = daysInMonth(ny, nm);
  const nd = Math.min(d, dim);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

function mondayMidnightMsForAlmatyDateKey(dateKey) {
  const parts = parseDateKey(dateKey);
  const noonIso = utcIsoFromAlmatyDateKeyAndTime(
    `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`,
    '12:00'
  );
  const d = toDate(noonIso);
  if (!d) return Date.now();
  const wd = almatyMon1Sun7(d);
  const daysFromMon = wd === 7 ? 6 : wd - 1;
  const keyMon = addDaysToDateKey(dateKey, -daysFromMon);
  return utcIsoFromAlmatyDateKeyAndTime(keyMon, '00:00');
}

function isWeekdayMon17(wd) {
  return wd >= 1 && wd <= 5;
}

/**
 * One step: next occurrence strictly after `scheduledAt` (single advance).
 */
export function computeNextScheduledOnce(scheduledAt, rule) {
  const t = toDate(scheduledAt);
  if (!t || !rule) return null;

  const type = rule.recurrence_type || 'none';
  if (type === 'none') return null;

  const interval = Math.max(1, Math.min(365, Number(rule.recurrence_interval) || 1));
  const timeHm = almatyTimeHmFromInstant(t);
  let dateKey = almatyDateKeyFromInstant(t);

  if (type === 'daily') {
    const nextKey = addDaysToDateKey(dateKey, interval);
    return utcIsoFromAlmatyDateKeyAndTime(nextKey, timeHm);
  }

  if (type === 'weekly') {
    const nextKey = addDaysToDateKey(dateKey, 7 * interval);
    return utcIsoFromAlmatyDateKeyAndTime(nextKey, timeHm);
  }

  if (type === 'weekdays') {
    let k = addDaysToDateKey(dateKey, 1);
    for (let i = 0; i < 14; i++) {
      const iso = utcIsoFromAlmatyDateKeyAndTime(k, timeHm);
      const wd = almatyMon1Sun7(iso);
      if (isWeekdayMon17(wd)) return iso;
      k = addDaysToDateKey(k, 1);
    }
    return utcIsoFromAlmatyDateKeyAndTime(addDaysToDateKey(dateKey, 1), timeHm);
  }

  if (type === 'monthly') {
    const nextKey = addMonthsKeepDayOrLast(dateKey, interval);
    return utcIsoFromAlmatyDateKeyAndTime(nextKey, timeHm);
  }

  if (type === 'custom') {
    const unit = rule.recurrence_custom_unit;
    const wds = normalizeWeekdays(rule.recurrence_weekdays);

    if (unit === 'day') {
      const nextKey = addDaysToDateKey(dateKey, interval);
      return utcIsoFromAlmatyDateKeyAndTime(nextKey, timeHm);
    }

    if (unit === 'month') {
      const nextKey = addMonthsKeepDayOrLast(dateKey, interval);
      return utcIsoFromAlmatyDateKeyAndTime(nextKey, timeHm);
    }

    if (unit === 'week') {
      if (!wds.length) return utcIsoFromAlmatyDateKeyAndTime(addDaysToDateKey(dateKey, 7 * interval), timeHm);

      const anchorMondayMs = new Date(mondayMidnightMsForAlmatyDateKey(dateKey)).getTime();

      let probeKey = addDaysToDateKey(dateKey, 1);
      for (let step = 0; step < 800; step++) {
        const iso = utcIsoFromAlmatyDateKeyAndTime(probeKey, timeHm);
        const probeDate = toDate(iso);
        if (!probeDate) break;

        const wd = almatyMon1Sun7(probeDate);
        if (!wds.includes(wd)) {
          probeKey = addDaysToDateKey(probeKey, 1);
          continue;
        }

        const candMondayMs = new Date(mondayMidnightMsForAlmatyDateKey(probeKey)).getTime();
        const weekIndex = Math.round((candMondayMs - anchorMondayMs) / MS_WEEK);
        if (weekIndex % interval !== 0) {
          probeKey = addDaysToDateKey(probeKey, 1);
          continue;
        }

        if (probeDate.getTime() > t.getTime()) return iso;
        probeKey = addDaysToDateKey(probeKey, 1);
      }
      return utcIsoFromAlmatyDateKeyAndTime(addDaysToDateKey(dateKey, 7 * interval), timeHm);
    }
  }

  return null;
}

/**
 * Advance until strictly after `now` (overdue catch-up).
 */
export function computeNextScheduledAfterNow(scheduledAt, rule, now = new Date()) {
  let cur = scheduledAt;
  let next = computeNextScheduledOnce(cur, rule);
  if (!next) return null;

  let guard = 0;
  while (next && toDate(next) <= now && guard < 2000) {
    cur = next;
    next = computeNextScheduledOnce(cur, rule);
    guard += 1;
  }
  return next;
}

export function normalizeWeekdays(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const nums = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function parseRecurrenceFromBody(body) {
  if (!body || body.recurrence_type === undefined) return null;

  const type = typeof body.recurrence_type === 'string' ? body.recurrence_type.trim().toLowerCase() : 'none';
  if (!RECURRENCE_TYPES.has(type)) {
    throw new BadRequestError('Некорректный тип повтора');
  }

  let interval = Number(body.recurrence_interval);
  if (!Number.isFinite(interval) || interval < 1) interval = 1;
  if (interval > 365) interval = 365;

  let customUnit = body.recurrence_custom_unit;
  if (customUnit != null && typeof customUnit === 'string') {
    customUnit = customUnit.trim().toLowerCase();
    if (!CUSTOM_UNITS.has(customUnit)) {
      throw new BadRequestError('Некорректная единица повтора');
    }
  } else {
    customUnit = null;
  }

  const weekdays = normalizeWeekdays(body.recurrence_weekdays);

  if (type === 'none') {
    return { recurrence_type: 'none', recurrence_interval: 1, recurrence_custom_unit: null, recurrence_weekdays: null };
  }

  if (type === 'custom') {
    if (!customUnit) throw new BadRequestError('Укажите единицу для своего варианта повтора');
    if (customUnit === 'week' && weekdays.length === 0) {
      throw new BadRequestError('Выберите хотя бы один день недели');
    }
  } else if (customUnit != null) {
    throw new BadRequestError('Лишнее поле единицы повтора');
  }

  if (type !== 'custom' && weekdays.length > 0) {
    throw new BadRequestError('Дни недели только для своего варианта (недели)');
  }

  if (type === 'daily' || type === 'weekly' || type === 'weekdays' || type === 'monthly') {
    return {
      recurrence_type: type,
      recurrence_interval: 1,
      recurrence_custom_unit: null,
      recurrence_weekdays: null,
    };
  }

  return {
    recurrence_type: 'custom',
    recurrence_interval: interval,
    recurrence_custom_unit: customUnit,
    recurrence_weekdays: customUnit === 'week' ? weekdays : null,
  };
}

export { RECURRENCE_TYPES, CUSTOM_UNITS };
