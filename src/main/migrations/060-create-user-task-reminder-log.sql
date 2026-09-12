-- Log of sent reminders for user tasks (dedupe + debugging)
CREATE TABLE IF NOT EXISTS user_task_reminder_logs (
    id            SERIAL PRIMARY KEY,
    user_task_id  INTEGER NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remind_at     TIMESTAMPTZ NOT NULL,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent | failed
    error         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure we never send the same reminder twice for one task time
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_task_reminder_logs_task_user_time
  ON user_task_reminder_logs(user_task_id, user_id, remind_at);

CREATE INDEX IF NOT EXISTS idx_user_task_reminder_logs_user
  ON user_task_reminder_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_user_task_reminder_logs_sent_at
  ON user_task_reminder_logs(sent_at);
