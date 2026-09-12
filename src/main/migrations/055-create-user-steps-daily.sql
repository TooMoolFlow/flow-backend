-- Таблица для синка шагов и отправки пуш-уведомлений шагомера (50%, почти цель, нет активности)

CREATE TABLE IF NOT EXISTS public.user_steps_daily (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER      NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    date                        DATE         NOT NULL,
    steps_today                 INTEGER      NOT NULL DEFAULT 0,
    goal_steps                  INTEGER      NULL,
    no_activity_interval_hours  SMALLINT     NOT NULL DEFAULT 2,
    steps_notifications_enabled BOOLEAN      NOT NULL DEFAULT true,
    last_steps_value            INTEGER      NOT NULL DEFAULT 0,
    last_steps_at               TIMESTAMP WITH TIME ZONE NULL,
    fifty_sent_at               TIMESTAMP WITH TIME ZONE NULL,
    almost_goal_sent_at         TIMESTAMP WITH TIME ZONE NULL,
    no_activity_count           SMALLINT     NOT NULL DEFAULT 0,
    no_activity_last_sent_at    TIMESTAMP WITH TIME ZONE NULL,
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_steps_daily_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_steps_daily_user_id ON public.user_steps_daily (user_id);
CREATE INDEX IF NOT EXISTS idx_user_steps_daily_date ON public.user_steps_daily (date);
CREATE INDEX IF NOT EXISTS idx_user_steps_daily_notifications ON public.user_steps_daily (date, steps_notifications_enabled) WHERE goal_steps > 0 AND steps_notifications_enabled = true;

COMMENT ON TABLE public.user_steps_daily IS 'Синк шагов с приложения и флаги отправки пуш-уведомлений шагомера (50% цели, почти цель, нет активности)';
