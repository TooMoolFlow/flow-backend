CREATE TABLE IF NOT EXISTS request_logs (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (
        action_type IN (
            'created', 'updated', 'status_changed', 'assigned', 'started', 
            'completed', 'rejected', 'commented', 'photo_added', 'long_term_toggled',
            'returned', 'priority_changed', 'category_changed', 'location_changed', 'deleted'
        )
    ),
    action_description TEXT NOT NULL,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX idx_request_logs_request_id ON request_logs(request_id);
CREATE INDEX idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX idx_request_logs_action_type ON request_logs(action_type);
CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX idx_request_logs_request_created ON request_logs(request_id, created_at);
