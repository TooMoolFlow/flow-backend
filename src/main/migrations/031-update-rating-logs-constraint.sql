-- Обновление CHECK constraint для rating_type в таблице rating_logs
-- Удаляем старый constraint
ALTER TABLE rating_logs DROP CONSTRAINT IF EXISTS rating_logs_rating_type_check;

-- Добавляем новый constraint без executor_rating
ALTER TABLE rating_logs ADD CONSTRAINT rating_logs_rating_type_check 
CHECK (rating_type IN ('client_rating', 'request_rating'));
