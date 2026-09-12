-- Add tables_remaining to meeting_room_bookings
-- Используем capacity (вместимость) из meeting_rooms вместо отдельного поля table_count

-- Добавляем поле оставшихся столов в бронирование
ALTER TABLE public.meeting_room_bookings
ADD COLUMN IF NOT EXISTS tables_remaining INTEGER;

-- Обновляем существующие бронирования: устанавливаем tables_remaining на основе capacity комнаты
UPDATE public.meeting_room_bookings mb
SET tables_remaining = mr.capacity
FROM public.meeting_rooms mr
WHERE mb.meeting_room_id = mr.id AND mb.tables_remaining IS NULL;

-- Устанавливаем NOT NULL после обновления всех записей
ALTER TABLE public.meeting_room_bookings
ALTER COLUMN tables_remaining SET NOT NULL;

