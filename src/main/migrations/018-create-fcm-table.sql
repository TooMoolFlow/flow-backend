-- Таблица FCM токенов (без попыток создать индексы через CONSTRAINT)
CREATE TABLE IF NOT EXISTS fcm_tokens (
                                          id         SERIAL PRIMARY KEY,
                                          user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,            -- создаст уникальный индекс автоматически
    platform   VARCHAR(10) NOT NULL DEFAULT 'android',
    device_id  VARCHAR(255),
    is_active  BOOLEAN NOT NULL DEFAULT true,
    last_used  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    -- Если очень нужен составной уникальный ключ (обычно не нужен, т.к. token уже UNIQUE):
    -- , CONSTRAINT uq_fcm_tokens_user_token UNIQUE (user_id, token)
    );

-- Отдельно создаём индексы (так правильно для Postgres)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id   ON fcm_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_platform  ON fcm_tokens (platform);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_is_active ON fcm_tokens (is_active);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_last_used ON fcm_tokens (last_used);

-- НЕ нужно дополнительно создавать индекс на token, он уже есть из-за UNIQUE
-- CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token); -- лишний
