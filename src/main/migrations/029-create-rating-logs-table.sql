-- Создание таблицы для логов оценок/рейтингов
CREATE TABLE rating_logs (
    id SERIAL PRIMARY KEY,
    rating_type VARCHAR(20) NOT NULL CHECK (rating_type IN ('client_rating', 'request_rating', 'executor_rating')),
    rating_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted')),
    action_description TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для оптимизации запросов
CREATE INDEX idx_rating_logs_rating_type ON rating_logs(rating_type);
CREATE INDEX idx_rating_logs_rating_id ON rating_logs(rating_id);
CREATE INDEX idx_rating_logs_user_id ON rating_logs(user_id);
CREATE INDEX idx_rating_logs_action_type ON rating_logs(action_type);
CREATE INDEX idx_rating_logs_created_at ON rating_logs(created_at);
CREATE INDEX idx_rating_logs_rating_type_rating_id ON rating_logs(rating_type, rating_id);
