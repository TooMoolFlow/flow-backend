-- Просмотры новостей (уникальный пользователь → одна засчитанная строка)
CREATE TABLE IF NOT EXISTS news_views (
    id         SERIAL PRIMARY KEY,
    news_id    INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (news_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_news_views_news_id ON news_views (news_id);

-- Реакции: одна активная реакция на пару (новость, пользователь); смена типа = UPDATE
CREATE TABLE IF NOT EXISTS news_reactions (
    id         SERIAL PRIMARY KEY,
    news_id    INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction   VARCHAR(16) NOT NULL CHECK (reaction IN ('thumb', 'heart', 'eyes', 'fire')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (news_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_news_reactions_news_id ON news_reactions (news_id);
