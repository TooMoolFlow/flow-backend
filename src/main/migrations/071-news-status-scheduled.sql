-- Добавить статус scheduled для отложенной публикации новостей
ALTER TABLE news DROP CONSTRAINT IF EXISTS news_status_check;
ALTER TABLE news ADD CONSTRAINT news_status_check
    CHECK (status IN ('active', 'hidden', 'archived', 'scheduled'));
