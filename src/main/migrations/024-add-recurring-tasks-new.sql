-- Миграция 024: Добавление функциональности повторяющихся задач (новая логика)
-- Используем request_type вместо is_recurring

-- 1. Добавляем значение 'recurring' в request_type (если ограничение уже существует)
DO $$
BEGIN
    -- Проверяем, существует ли ограничение
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'request_groups_request_type_check'
        AND table_name = 'request_groups'
    ) THEN
        -- Временно удаляем ограничение
        ALTER TABLE request_groups DROP CONSTRAINT request_groups_request_type_check;
        
        -- Добавляем новое ограничение с 'recurring'
        ALTER TABLE request_groups 
        ADD CONSTRAINT request_groups_request_type_check
        CHECK (request_type IN ('normal', 'urgent', 'planned', 'recurring'));
    END IF;
END $$;

-- 2. Добавляем новые поля в request_groups для повторяющихся задач
ALTER TABLE request_groups
    ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS next_due_date DATE,
    ADD COLUMN IF NOT EXISTS last_completed_date DATE,
    ADD COLUMN IF NOT EXISTS recurring_status VARCHAR(50) DEFAULT 'active';

-- Исправляем request_type для существующих повторяющихся задач
UPDATE request_groups 
SET request_type = 'recurring' 
WHERE (recurrence_type IS NOT NULL OR recurring_status IS NOT NULL) 
AND request_type != 'recurring';

-- 3. Добавляем ограничения для новых полей
ALTER TABLE request_groups
DROP CONSTRAINT IF EXISTS request_groups_recurrence_type_check;

ALTER TABLE request_groups
ADD CONSTRAINT request_groups_recurrence_type_check
    CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly'));

-- Безопасное исправление данных и ограничений для recurring_status
DO $$
BEGIN
    -- Сначала удаляем существующие ограничения, если они есть
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'request_groups_recurring_status_check'
        AND table_name = 'request_groups'
    ) THEN
        ALTER TABLE request_groups DROP CONSTRAINT request_groups_recurring_status_check;
    END IF;
    
    -- Теперь исправляем данные для recurring_status
    UPDATE request_groups 
    SET recurring_status = 'active' 
    WHERE recurring_status = 'recurring_active';

    UPDATE request_groups 
    SET recurring_status = 'paused' 
    WHERE recurring_status = 'recurring_paused';

    UPDATE request_groups 
    SET recurring_status = 'completed' 
    WHERE recurring_status = 'recurring_completed';

    -- Устанавливаем значения по умолчанию
    UPDATE request_groups 
    SET recurring_status = 'active' 
    WHERE recurring_status IS NULL;

    -- Исправляем любые другие невалидные значения
    UPDATE request_groups 
    SET recurring_status = 'active' 
    WHERE recurring_status IS NOT NULL 
    AND recurring_status NOT IN ('active', 'paused', 'completed');

    -- Теперь добавляем новое ограничение
    ALTER TABLE request_groups
    ADD CONSTRAINT request_groups_recurring_status_check
        CHECK (recurring_status IN ('active', 'paused', 'completed'));
END $$;

-- 4. Создаем таблицу для отслеживания выполнения повторяющихся задач
CREATE TABLE IF NOT EXISTS recurring_task_instances (
    id SERIAL PRIMARY KEY,
    request_group_id INT REFERENCES request_groups(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    completed_date DATE,
    completed_by INT REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue', 'skipped')),
    notes TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Создаем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_recurring_task_instances_due_date ON recurring_task_instances(due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_task_instances_request_group_id ON recurring_task_instances(request_group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_task_instances_status ON recurring_task_instances(status);
CREATE INDEX IF NOT EXISTS idx_request_groups_recurring_status ON request_groups(recurring_status) WHERE request_type = 'recurring';

-- 6. Создаем функцию для автоматического создания экземпляров повторяющихся задач
CREATE OR REPLACE FUNCTION create_recurring_task_instances()
RETURNS void AS $$
DECLARE
    task_record RECORD;
    current_date DATE := CURRENT_DATE;
    next_date DATE;
    interval_days INTEGER;
BEGIN
    -- Находим все активные повторяющиеся задачи
    FOR task_record IN
        SELECT id, recurrence_type, recurrence_interval, next_due_date
        FROM request_groups
        WHERE request_type = 'recurring'
          AND recurring_status = 'active'
          AND next_due_date <= current_date
    LOOP
        -- Вычисляем интервал в днях
        CASE task_record.recurrence_type
            WHEN 'daily' THEN interval_days := task_record.recurrence_interval;
            WHEN 'weekly' THEN interval_days := task_record.recurrence_interval * 7;
            WHEN 'monthly' THEN interval_days := task_record.recurrence_interval * 30;
            WHEN 'yearly' THEN interval_days := task_record.recurrence_interval * 365;
        END CASE;

        -- Создаем экземпляры задач на следующие периоды
        next_date := task_record.next_due_date;

        WHILE next_date <= current_date + interval_days LOOP
            -- Проверяем, не существует ли уже экземпляр для этой даты
            IF NOT EXISTS (
                SELECT 1 FROM recurring_task_instances
                WHERE request_group_id = task_record.id
                AND due_date = next_date
            ) THEN
                INSERT INTO recurring_task_instances (request_group_id, due_date, status)
                VALUES (task_record.id, next_date, 'pending');
            END IF;

            next_date := next_date + interval_days;
        END LOOP;

        -- Обновляем следующую дату выполнения
        UPDATE request_groups
        SET next_due_date = next_date
        WHERE id = task_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. Создаем триггер для автоматического обновления дат
CREATE OR REPLACE FUNCTION update_recurring_task_dates()
RETURNS TRIGGER AS $$
DECLARE
    interval_days INTEGER;
BEGIN
    -- Если задача была завершена, вычисляем следующую дату
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        CASE NEW.recurrence_type
            WHEN 'daily' THEN interval_days := NEW.recurrence_interval;
            WHEN 'weekly' THEN interval_days := NEW.recurrence_interval * 7;
            WHEN 'monthly' THEN interval_days := NEW.recurrence_interval * 30;
            WHEN 'yearly' THEN interval_days := NEW.recurrence_interval * 365;
        END CASE;

        -- Обновляем последнюю дату выполнения и следующую дату
        NEW.last_completed_date := CURRENT_DATE;
        NEW.next_due_date := CURRENT_DATE + interval_days;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Создаем триггер
DROP TRIGGER IF EXISTS trigger_update_recurring_task_dates ON request_groups;
CREATE TRIGGER trigger_update_recurring_task_dates
    BEFORE UPDATE ON request_groups
    FOR EACH ROW
    WHEN (NEW.request_type = 'recurring')
    EXECUTE FUNCTION update_recurring_task_dates();

-- 9. Добавляем комментарии к полям
COMMENT ON COLUMN request_groups.recurrence_type IS 'Тип повторения: daily, weekly, monthly, yearly';
COMMENT ON COLUMN request_groups.recurrence_interval IS 'Интервал повторения (количество дней/недель/месяцев/лет)';
COMMENT ON COLUMN request_groups.next_due_date IS 'Следующая дата выполнения повторяющейся задачи';
COMMENT ON COLUMN request_groups.last_completed_date IS 'Дата последнего выполнения повторяющейся задачи';
COMMENT ON COLUMN request_groups.recurring_status IS 'Статус повторяющейся задачи: active, paused, completed';

-- 10. Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_request_groups_next_due_date ON request_groups(next_due_date) WHERE request_type = 'recurring';
CREATE INDEX IF NOT EXISTS idx_request_groups_recurrence_type ON request_groups(recurrence_type) WHERE request_type = 'recurring';
