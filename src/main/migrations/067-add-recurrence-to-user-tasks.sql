-- Recurrence for user to-do tasks (same row, scheduled_at as anchor)
ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(32) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_custom_unit VARCHAR(16),
  ADD COLUMN IF NOT EXISTS recurrence_weekdays JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_recurrence_type_check') THEN
    ALTER TABLE user_tasks
      ADD CONSTRAINT user_tasks_recurrence_type_check
      CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'weekdays', 'monthly', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_recurrence_interval_check') THEN
    ALTER TABLE user_tasks
      ADD CONSTRAINT user_tasks_recurrence_interval_check
      CHECK (recurrence_interval >= 1 AND recurrence_interval <= 365);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_tasks_recurrence_custom_unit_check') THEN
    ALTER TABLE user_tasks
      ADD CONSTRAINT user_tasks_recurrence_custom_unit_check
      CHECK (
        recurrence_custom_unit IS NULL
        OR recurrence_custom_unit IN ('day', 'week', 'month')
      );
  END IF;
END $$;
