-- Создание таблицы для подписок клиентов на комнаты для управления умным домом
CREATE TABLE IF NOT EXISTS client_room_subscriptions (
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    meeting_room_id INT NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, meeting_room_id)
);

-- Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_client_room_subscriptions_client_id ON client_room_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_room_subscriptions_room_id ON client_room_subscriptions(meeting_room_id);

