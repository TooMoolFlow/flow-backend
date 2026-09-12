-- Кто завершил командную/общую задачу
ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_tasks_completed_by ON user_tasks(completed_by);
