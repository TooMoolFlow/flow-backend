-- Хранение created_at в UTC (TIMESTAMP WITH TIME ZONE).
-- Существующие значения считались записанными в локальном времени (+05), конвертируем в UTC.
ALTER TABLE notifications
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
  USING created_at AT TIME ZONE 'Asia/Almaty';
