-- Создание таблицы request_groups (главные заявки)
CREATE TABLE IF NOT EXISTS request_groups (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES users(id) ON DELETE SET NULL,
    office_id INT REFERENCES offices(id) ON DELETE SET NULL,
    location VARCHAR(255) NOT NULL,
    location_detail VARCHAR(255),
    date_submitted TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL CHECK (
        status IN (
            'in_progress', 'execution', 'completed', 'rejected',
            'awaiting_assignment', 'awaiting_sla', 'assigned'
        )
    ),
    rejection_reason TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    planned_date DATE
);

-- 1. Создаем request_groups для каждой существующей заявки
-- ИСПРАВЛЕНИЕ: Сохраняем оригинальный request_id для связи
INSERT INTO request_groups (id, client_id, office_id, location, location_detail, date_submitted, status, rejection_reason, created_date)
SELECT
    id,  -- Используем тот же ID что и в requests
    client_id,
    office_id,
    location,
    location_detail,
    date_submitted,
    status,
    rejection_reason,
    created_date
FROM requests;

-- 2. Добавляем request_group_id в requests (пока не удаляем старые колонки)
ALTER TABLE requests ADD COLUMN request_group_id INT REFERENCES request_groups(id) ON DELETE CASCADE;

-- 3. Обновляем requests, устанавливая request_group_id = id (так как мы использовали тот же ID)
UPDATE requests SET request_group_id = id;

-- 4. Теперь можно безопасно удалить старые колонки
ALTER TABLE requests
    DROP COLUMN client_id,
    DROP COLUMN office_id,
    DROP COLUMN location,
    DROP COLUMN location_detail,
    DROP COLUMN date_submitted;

-- 5. Сохраняем executor_id во временной таблице перед удалением
CREATE TEMP TABLE temp_executors AS
SELECT id as request_id, executor_id 
FROM requests 
WHERE executor_id IS NOT NULL;

-- 6. Удаляем executor_id из requests
ALTER TABLE requests DROP COLUMN executor_id;

-- 7. Обработка request_photos
-- Добавляем временную колонку для связи с группой
ALTER TABLE request_photos ADD COLUMN request_group_id INT REFERENCES request_groups(id) ON DELETE CASCADE;

-- Заполняем request_group_id по текущему request_id
UPDATE request_photos rp
SET request_group_id = r.request_group_id
FROM requests r
WHERE rp.request_id = r.id;

-- Удаляем старый foreign key и колонку request_id
ALTER TABLE request_photos DROP CONSTRAINT IF EXISTS request_photos_request_id_fkey;
ALTER TABLE request_photos DROP COLUMN request_id;

-- Переименовываем новую колонку в request_id
ALTER TABLE request_photos RENAME COLUMN request_group_id TO request_id;

-- Добавляем foreign key на request_groups
ALTER TABLE request_photos
    ADD CONSTRAINT request_photos_request_id_fkey FOREIGN KEY (request_id)
        REFERENCES request_groups(id) ON DELETE CASCADE;

ALTER TABLE request_photos DROP CONSTRAINT IF EXISTS request_photos_request_group_id_fkey;