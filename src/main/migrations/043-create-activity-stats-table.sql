-- Create activity_stats table to store employee activity statistics

CREATE TABLE IF NOT EXISTS public.activity_stats (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER      NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    date                DATE         NOT NULL,
    total_sitting_time  INTEGER      NOT NULL DEFAULT 0, -- время в секундах
    total_standing_time INTEGER      NOT NULL DEFAULT 0, -- время в секундах
    stand_up_count      INTEGER      NOT NULL DEFAULT 0, -- количество вставаний
    is_in_office        BOOLEAN      NOT NULL DEFAULT false,
    location_latitude    DECIMAL(10, 8),
    location_longitude  DECIMAL(11, 8),
    location_accuracy   DECIMAL(10, 2), -- точность в метрах
    created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_stats_user_id ON public.activity_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_stats_date ON public.activity_stats (date);
CREATE INDEX IF NOT EXISTS idx_activity_stats_user_date ON public.activity_stats (user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_stats_in_office ON public.activity_stats (is_in_office, date);

-- Trigger to keep updated_at in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_activity_stats_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.activity_stats_set_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_activity_stats_set_updated_at
    BEFORE UPDATE ON public.activity_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.activity_stats_set_updated_at();
  END IF;
END$$;

