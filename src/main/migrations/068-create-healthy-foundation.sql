CREATE TABLE IF NOT EXISTS public.healthy_profiles (
    id                           SERIAL PRIMARY KEY,
    user_id                      INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    sleep_goal_minutes           INTEGER NOT NULL DEFAULT 480,
    steps_goal                   INTEGER NULL,
    weight_kg                    NUMERIC(6,2) NULL,
    height_cm                    NUMERIC(6,2) NULL,
    timezone                     VARCHAR(64) NOT NULL DEFAULT 'UTC',
    health_data_consent          BOOLEAN NOT NULL DEFAULT false,
    apple_health_enabled         BOOLEAN NOT NULL DEFAULT false,
    sleep_notifications_enabled  BOOLEAN NOT NULL DEFAULT true,
    steps_notifications_enabled  BOOLEAN NOT NULL DEFAULT true,
    no_activity_interval_hours   SMALLINT NOT NULL DEFAULT 2,
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.healthy_metric_daily (
    id                           SERIAL PRIMARY KEY,
    user_id                      INTEGER NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    date                         DATE NOT NULL,
    sleep_minutes                INTEGER NULL,
    sleep_rating                 VARCHAR(16) NULL,
    water_ml                     INTEGER NULL,
    water_goal_ml                INTEGER NULL,
    steps_count                  INTEGER NULL,
    mood_value                   INTEGER NULL,
    energy_level                 VARCHAR(16) NULL,
    stress_level                 VARCHAR(16) NULL,
    data_sources                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    completeness_score           NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_healthy_metric_daily_user_date UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.healthy_recommendation_content (
    id                           SERIAL PRIMARY KEY,
    content_key                  VARCHAR(128) NOT NULL UNIQUE,
    metric_tags                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    period_tags                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    tone                         VARCHAR(32) NOT NULL DEFAULT 'neutral',
    text                         TEXT NOT NULL,
    source_ref                   VARCHAR(255) NOT NULL,
    status                       VARCHAR(32) NOT NULL DEFAULT 'approved',
    safety_flags                 JSONB NOT NULL DEFAULT '[]'::jsonb,
    locale                       VARCHAR(16) NOT NULL DEFAULT 'ru',
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.healthy_insight_snapshots (
    id                           SERIAL PRIMARY KEY,
    user_id                      INTEGER NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    period_type                  VARCHAR(16) NOT NULL,
    period_start                 DATE NOT NULL,
    period_end                   DATE NOT NULL,
    status_label                 VARCHAR(64) NOT NULL,
    status_tone                  VARCHAR(16) NOT NULL,
    summary                      TEXT NOT NULL,
    weak_points_json             JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendation_ids_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
    support_message              TEXT NOT NULL,
    low_data_flag                BOOLEAN NOT NULL DEFAULT false,
    payload                      JSONB NOT NULL DEFAULT '{}'::jsonb,
    engine_version               VARCHAR(32) NOT NULL,
    generated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_healthy_insight_snapshot_period UNIQUE (user_id, period_type, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.healthy_generation_logs (
    id                           SERIAL PRIMARY KEY,
    user_id                      INTEGER NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    period_type                  VARCHAR(16) NOT NULL,
    period_start                 DATE NOT NULL,
    period_end                   DATE NOT NULL,
    success                      BOOLEAN NOT NULL DEFAULT true,
    model_used                   VARCHAR(64) NULL,
    engine_version               VARCHAR(32) NOT NULL,
    fallback_reason              VARCHAR(255) NULL,
    blocked_topics               JSONB NOT NULL DEFAULT '[]'::jsonb,
    safety_decisions             JSONB NOT NULL DEFAULT '{}'::jsonb,
    latency_ms                   INTEGER NULL,
    error_message                TEXT NULL,
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_healthy_metric_daily_user_id ON public.healthy_metric_daily (user_id);
CREATE INDEX IF NOT EXISTS idx_healthy_metric_daily_date ON public.healthy_metric_daily (date);
CREATE INDEX IF NOT EXISTS idx_healthy_metric_daily_user_date_desc ON public.healthy_metric_daily (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_healthy_recommendation_content_status ON public.healthy_recommendation_content (status);
CREATE INDEX IF NOT EXISTS idx_healthy_recommendation_content_locale ON public.healthy_recommendation_content (locale);

CREATE INDEX IF NOT EXISTS idx_healthy_insight_snapshots_user_period ON public.healthy_insight_snapshots (user_id, period_type);
CREATE INDEX IF NOT EXISTS idx_healthy_insight_snapshots_generated_at ON public.healthy_insight_snapshots (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_healthy_generation_logs_user_period ON public.healthy_generation_logs (user_id, period_type, created_at DESC);

COMMENT ON TABLE public.healthy_profiles IS 'Профиль и цели пользователя для healthy-модуля';
COMMENT ON TABLE public.healthy_metric_daily IS 'Агрегированные daily health-метрики пользователя';
COMMENT ON TABLE public.healthy_recommendation_content IS 'Утвержденный контент-банк healthy-рекомендаций';
COMMENT ON TABLE public.healthy_insight_snapshots IS 'Сохраненные day/week/month snapshot-инсайты';
COMMENT ON TABLE public.healthy_generation_logs IS 'Логи генерации healthy-инсайтов и safety-решений';
