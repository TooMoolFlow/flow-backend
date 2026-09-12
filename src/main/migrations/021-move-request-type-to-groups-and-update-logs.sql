-- Миграция 21: Перенос request_type из requests в request_groups и обновление request_logs
-- Дата: 2024-12-19

-- 1. Добавляем поле request_type в таблицу request_groups
ALTER TABLE request_groups 
ADD COLUMN request_type VARCHAR(50) NOT NULL DEFAULT 'normal' 
CHECK (request_type IN ('normal', 'urgent', 'planned'));

-- 2. Обновляем request_groups на основе подзаявок
-- Если есть хотя бы одна плановая подзаявка, делаем группу плановой
UPDATE request_groups 
SET request_type = 'planned', 
    planned_date = COALESCE(planned_date, NOW() + INTERVAL '1 day')
WHERE id IN (
    SELECT DISTINCT rg.id 
    FROM request_groups rg
    INNER JOIN requests r ON r.request_group_id = rg.id
    WHERE r.request_type = 'planned'
);

-- Если есть хотя бы одна срочная подзаявка (и нет плановых), делаем группу срочной
UPDATE request_groups 
SET request_type = 'urgent'
WHERE id IN (
    SELECT DISTINCT rg.id 
    FROM request_groups rg
    INNER JOIN requests r ON r.request_group_id = rg.id
    WHERE r.request_type = 'urgent'
    AND rg.request_type != 'planned'
);

-- Остальные группы остаются normal (по умолчанию)

-- 3. Удаляем поле request_type из таблицы requests
ALTER TABLE requests DROP COLUMN request_type;

-- 4. Обновляем request_logs для работы с группами заявок
-- Сначала добавляем новое поле request_group_id
ALTER TABLE request_logs 
ADD COLUMN request_group_id INTEGER REFERENCES request_groups(id) ON DELETE CASCADE;

-- Обновляем существующие записи в request_logs
-- Для записей, связанных с подзаявками, устанавливаем request_group_id
UPDATE request_logs 
SET request_group_id = (
    SELECT r.request_group_id 
    FROM requests r 
    WHERE r.id = request_logs.request_id
)
WHERE request_id IN (
    SELECT id FROM requests
);

-- Для записей, которые уже ссылаются на группы заявок, копируем request_id в request_group_id
UPDATE request_logs 
SET request_group_id = request_id
WHERE request_id IN (
    SELECT id FROM request_groups
);

-- 5. Удаляем старое поле request_id из request_logs
ALTER TABLE request_logs DROP COLUMN request_id;

-- 6. Переименовываем request_group_id в request_id для обратной совместимости
ALTER TABLE request_logs RENAME COLUMN request_group_id TO request_id;

-- 7. Обновляем индексы
DROP INDEX IF EXISTS idx_request_logs_request_id;
CREATE INDEX idx_request_logs_request_id ON request_logs(request_id);

-- 8. Обновляем ограничения
ALTER TABLE request_logs 
ADD CONSTRAINT fk_request_logs_request_id 
FOREIGN KEY (request_id) REFERENCES request_groups(id) ON DELETE CASCADE;

-- 9. Обновляем action_type в request_logs для поддержки новых типов действий
ALTER TABLE request_logs 
DROP CONSTRAINT IF EXISTS request_logs_action_type_check;

ALTER TABLE request_logs 
ADD CONSTRAINT request_logs_action_type_check 
CHECK (action_type IN (
    'created',           -- Заявка создана
    'group_created',     -- Группа заявок создана
    'sub_request_created', -- Подзаявка создана
    'updated',           -- Заявка обновлена
    'status_changed',    -- Изменен статус
    'assigned',          -- Назначен исполнитель
    'unassigned',        -- Снят исполнитель
    'started',           -- Начато выполнение
    'completed',         -- Завершено
    'rejected',          -- Отклонено
    'commented',         -- Добавлен комментарий
    'photo_added',       -- Добавлено фото
    'long_term_toggled', -- Изменен флаг долгосрочной заявки
    'returned',          -- Возвращена на доработку
    'priority_changed',  -- Изменен приоритет
    'category_changed',  -- Изменена категория
    'location_changed',  -- Изменено местоположение
    'deleted'            -- Заявка удалена
));
