-- Миграция 22: Исправление последовательности request_groups для избежания конфликтов ID
-- Дата: 2024-12-19

-- Настройка последовательности для request_groups чтобы избежать конфликтов ID с requests
DO $$
DECLARE
    max_request_id INTEGER;
    max_request_group_id INTEGER;
    next_sequence_value INTEGER;
BEGIN
    -- Получаем максимальный ID из requests
    SELECT COALESCE(MAX(id), 0) INTO max_request_id FROM requests;
    
    -- Получаем максимальный ID из request_groups
    SELECT COALESCE(MAX(id), 0) INTO max_request_group_id FROM request_groups;
    
    -- Определяем следующее значение для последовательности
    next_sequence_value = GREATEST(max_request_id, max_request_group_id) + 1;
    
    -- Устанавливаем следующее значение последовательности для request_groups
    EXECUTE format('ALTER SEQUENCE request_groups_id_seq RESTART WITH %s', next_sequence_value);
    
    RAISE NOTICE 'Последовательность request_groups_id_seq установлена на значение: %', next_sequence_value;
END $$;
