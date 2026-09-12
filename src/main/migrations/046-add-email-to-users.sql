-- Добавление поля email и email_verified в таблицу users
ALTER TABLE users
    ADD COLUMN email VARCHAR(255) UNIQUE,
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN email_verification_code VARCHAR(6),
    ADD COLUMN email_verification_code_expires_at TIMESTAMP;

-- Создание индекса для email
CREATE INDEX idx_users_email ON users(email);

