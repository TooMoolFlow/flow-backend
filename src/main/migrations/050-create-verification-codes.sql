-- Создание таблицы для хранения кодов верификации SMS
CREATE TABLE IF NOT EXISTS verification_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('registration', 'password_reset')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Индексы для быстрого поиска
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX idx_verification_codes_code ON verification_codes(code);
CREATE INDEX idx_verification_codes_expires_at ON verification_codes(expires_at);
CREATE INDEX idx_verification_codes_phone_purpose ON verification_codes(phone, purpose);

-- Удаление истекших кодов (можно настроить cron job для периодической очистки)
-- DELETE FROM verification_codes WHERE expires_at < NOW();

