-- Задачи, явно остающиеся во «Входящие» даже при scheduled_at (клиент: вкладка Входящие).
ALTER TABLE user_tasks
    ADD COLUMN IF NOT EXISTS inbox BOOLEAN NOT NULL DEFAULT false;
