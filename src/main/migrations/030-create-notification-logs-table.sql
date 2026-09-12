-- Создание таблицы для логов уведомлений
CREATE TABLE notification_logs (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('email', 'push', 'in_app')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
    error_message TEXT,
    recipient_email VARCHAR(255),
    fcm_token VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов для оптимизации запросов
CREATE INDEX idx_notification_logs_notification_id ON notification_logs(notification_id);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_delivery_method ON notification_logs(delivery_method);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);
CREATE INDEX idx_notification_logs_status_created_at ON notification_logs(status, created_at);
