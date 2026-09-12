CREATE TABLE client_ratings (
    id SERIAL PRIMARY KEY,
    rated_by INTEGER NOT NULL REFERENCES users(id),
    client_id INTEGER NOT NULL REFERENCES users(id),
    request_group_id INTEGER NOT NULL REFERENCES request_groups(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rated_by, request_group_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_client_ratings_rated_by ON client_ratings(rated_by);
CREATE INDEX idx_client_ratings_client_id ON client_ratings(client_id);
CREATE INDEX idx_client_ratings_request_group_id ON client_ratings(request_group_id);
