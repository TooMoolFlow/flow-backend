-- Создание таблицы для хранения токенов Яндекс умного дома
-- Без привязки к пользователям, работает как офис
CREATE TABLE IF NOT EXISTS yandex_smart_home_tokens (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

