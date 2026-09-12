-- Миграция 026: Синхронизация структуры таблицы request_groups с моделью RequestGroup
-- Исправляем данные и удаляем старое поле is_recurring

-- 1. Добавляем поле request_type, если его нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'request_groups' 
        AND column_name = 'request_type'
    ) THEN
        ALTER TABLE request_groups 
        ADD COLUMN request_type VARCHAR(50) NOT NULL DEFAULT 'normal';
    END IF;
END $$;

-- 1.1. Обновляем ограничение для request_type (если не обновлено в 024)
ALTER TABLE request_groups
DROP CONSTRAINT IF EXISTS request_groups_request_type_check;

ALTER TABLE request_groups
ADD CONSTRAINT request_groups_request_type_check
    CHECK (request_type IN ('normal', 'urgent', 'planned', 'recurring'));

-- 2. Обновляем ограничение для поля status
ALTER TABLE request_groups
DROP CONSTRAINT IF EXISTS request_groups_status_check;

ALTER TABLE request_groups
ADD CONSTRAINT request_groups_status_check
    CHECK (status IN (
        'in_progress', 'execution', 'completed', 'rejected',
        'awaiting_assignment', 'awaiting_sla', 'assigned'
    ));

-- 3. Обновляем ограничение для поля recurring_status (если не обновлено в 024)
ALTER TABLE request_groups
DROP CONSTRAINT IF EXISTS request_groups_recurring_status_check;

ALTER TABLE request_groups
ADD CONSTRAINT request_groups_recurring_status_check
    CHECK (recurring_status IN ('active', 'paused', 'completed'));

-- 4. Добавляем ограничение для поля recurrence_type (если не обновлено в 024)
ALTER TABLE request_groups
DROP CONSTRAINT IF EXISTS request_groups_recurrence_type_check;

ALTER TABLE request_groups
ADD CONSTRAINT request_groups_recurrence_type_check
    CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly'));

-- 5. Удаляем старое поле is_recurring, если оно существует
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'request_groups' 
        AND column_name = 'is_recurring'
    ) THEN
        -- Сначала удаляем триггер, который зависит от поля is_recurring
        DROP TRIGGER IF EXISTS trigger_update_recurring_task_dates ON request_groups;
        
        -- Обновляем существующие повторяющиеся задачи
        UPDATE request_groups 
        SET request_type = 'recurring' 
        WHERE is_recurring = true;
        
        -- Затем удаляем поле
        ALTER TABLE request_groups DROP COLUMN is_recurring;
    END IF;
END $$;

-- 6. Добавляем комментарии к полям для документации (если не добавлены в 024)
COMMENT ON COLUMN request_groups.request_type IS 'Тип заявки: normal, urgent, planned, recurring';

-- 7. Создаем индексы для оптимизации запросов (если не созданы в 024)
CREATE INDEX IF NOT EXISTS idx_request_groups_request_type ON request_groups(request_type);

-- 8. Обновляем существующие записи, устанавливая правильные значения по умолчанию
-- (Данные уже исправлены выше)
UPDATE request_groups 
SET request_type = 'normal' 
WHERE request_type IS NULL;

UPDATE request_groups 
SET recurring_status = 'active' 
WHERE request_type = 'recurring' AND recurring_status IS NULL;

-- 9. Проверяем целостность данных (временно отключено)
-- DO $$
-- BEGIN
--     -- Проверяем, что все записи имеют корректные значения
--     IF EXISTS (
--         SELECT 1 FROM request_groups 
--         WHERE request_type IS NOT NULL AND request_type NOT IN ('normal', 'urgent', 'planned', 'recurring')
--     ) THEN
--         RAISE EXCEPTION 'Found invalid request_type values';
--     END IF;
--     
--     IF EXISTS (
--         SELECT 1 FROM request_groups 
--         WHERE request_type = 'recurring' AND recurrence_type IS NOT NULL AND recurrence_type NOT IN ('daily', 'weekly', 'monthly', 'yearly')
--     ) THEN
--         RAISE EXCEPTION 'Found invalid recurrence_type values for recurring tasks';
--     END IF;
--     
--     -- Проверяем, что все записи имеют корректные значения recurring_status
--     IF EXISTS (
--         SELECT 1 FROM request_groups 
--         WHERE recurring_status IS NOT NULL 
--         AND recurring_status NOT IN ('active', 'paused', 'completed')
--     ) THEN
--         RAISE EXCEPTION 'Found invalid recurring_status values';
--     END IF;
-- END $$;
