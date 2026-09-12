-- Add priority to user tasks: low | medium | high
ALTER TABLE user_tasks
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'medium';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_tasks_priority_check'
    ) THEN
        ALTER TABLE user_tasks
        ADD CONSTRAINT user_tasks_priority_check
        CHECK (priority IN ('low', 'medium', 'high'));
    END IF;
END $$;
