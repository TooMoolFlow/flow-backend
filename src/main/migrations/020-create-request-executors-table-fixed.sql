-- Создание таблицы request_executors (связь многие-ко-многим)
CREATE TABLE IF NOT EXISTS request_executors (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    executor_id INT NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'executor' CHECK (
        role IN ('executor', 'leader')
    ),
    UNIQUE(request_id, executor_id)
);

-- ИСПРАВЛЕНИЕ: Используем временную таблицу из миграции 019
-- Создаем записи в request_executors для существующих исполнителей
INSERT INTO request_executors (request_id, executor_id, role)
SELECT
    request_id,
    executor_id,
    'leader' as role
FROM temp_executors
WHERE executor_id IS NOT NULL;

-- Удаляем временную таблицу
DROP TABLE temp_executors;
