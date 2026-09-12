CREATE TABLE IF NOT EXISTS news (
    id                SERIAL PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    content           TEXT NOT NULL,
    image_url         VARCHAR(1024),
    status            VARCHAR(32) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'hidden', 'archived')),
    notification_type VARCHAR(32) NOT NULL DEFAULT 'none'
                       CHECK (notification_type IN ('none', 'push_sound', 'push_silent')),
    published_at      TIMESTAMPTZ,
    created_by        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

