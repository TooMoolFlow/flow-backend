-- Миграция 23: Обновление ограничений action_type в таблице request_logs
-- Дата: 2024-12-19

-- Удаляем старое ограничение action_type
ALTER TABLE request_logs 
DROP CONSTRAINT IF EXISTS request_logs_action_type_check;

-- Добавляем новое ограничение с обновленными типами действий
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
