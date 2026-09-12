import { BadRequestError } from '../errors/errors.js';

export const toDateOnlyLocal = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`; // 'YYYY-MM-DD'
};

export const addDaysOnlyLocal = (dateOnlyStr, days) => {
    const [y, m, d] = dateOnlyStr.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    base.setDate(base.getDate() + days);
    return toDateOnlyLocal(base);
};

export const toIntervalDays = (type, interval) => {
    switch (type) {
        case 'daily':   return interval;
        case 'weekly':  return interval * 7;
        case 'monthly': return interval * 30;   // упростили
        case 'yearly':  return interval * 365;  // упростили
        default: throw new BadRequestError('Invalid recurrence type');
    }
};