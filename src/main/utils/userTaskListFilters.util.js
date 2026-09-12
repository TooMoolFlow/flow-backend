import { Op, literal } from 'sequelize';

const APP_TIMEZONE = 'Asia/Almaty';

/**
 * Календарный день планирования (как taskScheduledDayKey / toAppDateKey на клиенте).
 * timestamptz → локальное время APP_TIMEZONE → date (один шаг AT TIME ZONE, без UTC-цепочки).
 */
export const PLAN_DAY_SQL = `(
  CASE
    WHEN "UserTask"."scheduled_at" IS NOT NULL THEN
      (("UserTask"."scheduled_at" AT TIME ZONE '${APP_TIMEZONE}')::date)
    WHEN "UserTask"."inbox" = true AND "UserTask"."deadline_to" IS NOT NULL THEN
      "UserTask"."deadline_to"::date
    ELSE NULL
  END
)`;

export const COMPLETED_DAY_SQL = `(
  CASE
    WHEN "UserTask"."completed_at" IS NOT NULL THEN
      (("UserTask"."completed_at" AT TIME ZONE '${APP_TIMEZONE}')::date)
    ELSE NULL
  END
)`;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateKey(value, fieldName) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) {
    return null;
  }
  return value;
}

/** YYYY-MM-DD в Asia/Almaty для «сегодня» на сервере. */
export function todayDateKeyInAppTz() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Условия WHERE для view (дополняют accessWhere).
 * @returns {import('sequelize').WhereOptions[]}
 */
export function buildViewWhereClauses(view, query = {}) {
  const todayKey = parseDateKey(query.today, 'today') ?? parseDateKey(query.date, 'date') ?? todayDateKeyInAppTz();

  if (view === 'inbox') {
    return [
      {
        [Op.or]: [
          {
            [Op.and]: [{ completed: false }, { [Op.or]: [{ inbox: true }, { scheduled_at: { [Op.is]: null } }] }],
          },
          { [Op.and]: [{ completed: true }, { inbox: true }] },
        ],
      },
    ];
  }

  if (view === 'list_today') {
    return [
      {
        [Op.or]: [
          {
            [Op.and]: [
              { completed: true },
              literal(`${COMPLETED_DAY_SQL} = '${todayKey}'::date`),
            ],
          },
          {
            [Op.and]: [
              { completed: false },
              literal(`${PLAN_DAY_SQL} IS NOT NULL`),
              literal(`NOT ("UserTask"."inbox" = true AND ${PLAN_DAY_SQL} IS NULL)`),
              {
                [Op.or]: [
                  literal(`${PLAN_DAY_SQL} < '${todayKey}'::date`),
                  literal(`${PLAN_DAY_SQL} = '${todayKey}'::date`),
                ],
              },
            ],
          },
        ],
      },
    ];
  }

  if (view === 'list_upcoming') {
    const fromDate = parseDateKey(query.from_date, 'from_date');
    const toDate = parseDateKey(query.to_date, 'to_date');
    const clauses = [
      { completed: false },
      literal(`${PLAN_DAY_SQL} IS NOT NULL`),
      literal(`NOT ("UserTask"."inbox" = true AND ${PLAN_DAY_SQL} IS NULL)`),
      literal(`${PLAN_DAY_SQL} > '${todayKey}'::date`),
    ];
    if (fromDate) {
      clauses.push(literal(`${PLAN_DAY_SQL} >= '${fromDate}'::date`));
    }
    if (toDate) {
      clauses.push(literal(`${PLAN_DAY_SQL} <= '${toDate}'::date`));
    }
    return [{ [Op.and]: clauses }];
  }

  if (view === 'list_completed') {
    const completedOn = parseDateKey(query.completed_on, 'completed_on') ?? parseDateKey(query.date, 'date');
    if (!completedOn) {
      return [{ completed: true }];
    }
    return [
      { completed: true },
      literal(`${COMPLETED_DAY_SQL} = '${completedOn}'::date`),
    ];
  }

  return [];
}

export function orderForView(view) {
  if (view === 'inbox') {
    return [
      ['completed', 'ASC'],
      ['updated_at', 'DESC'],
    ];
  }
  if (view === 'list_upcoming') {
    return [
      [literal(PLAN_DAY_SQL), 'ASC'],
      ['scheduled_at', 'ASC'],
      ['deadline_to', 'ASC'],
      ['priority', 'DESC'],
      ['title', 'ASC'],
    ];
  }
  if (view === 'list_completed') {
    return [
      ['completed_at', 'DESC'],
      ['updated_at', 'DESC'],
    ];
  }
  if (view === 'list_today') {
    return [
      ['completed', 'ASC'],
      [literal(PLAN_DAY_SQL), 'ASC'],
      ['scheduled_at', 'ASC'],
      ['priority', 'DESC'],
      ['title', 'ASC'],
    ];
  }
  return [
    ['completed', 'ASC'],
    ['scheduled_at', 'ASC'],
    ['deadline_to', 'ASC'],
    ['updated_at', 'DESC'],
  ];
}
