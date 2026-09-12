-- Создание таблицы для связи устройств Яндекс умного дома с переговорными комнатами
CREATE TABLE IF NOT EXISTS meeting_room_devices (
    id SERIAL PRIMARY KEY,
    meeting_room_id INT NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meeting_room_id, device_id)
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_meeting_room_devices_room_id ON meeting_room_devices(meeting_room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_room_devices_device_id ON meeting_room_devices(device_id);

