-- Индексы для списков по вкладкам (inbox, completed + inbox)
CREATE INDEX IF NOT EXISTS idx_user_tasks_inbox_list
  ON user_tasks (completed, inbox, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tasks_inbox_flag
  ON user_tasks (inbox)
  WHERE inbox = true;
