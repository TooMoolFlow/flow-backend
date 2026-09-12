CREATE TABLE IF NOT EXISTS user_tasks_remind_before_minutes_tmp (
    id INTEGER PRIMARY KEY,
    remind_before_minutes INTEGER
);

INSERT INTO user_tasks_remind_before_minutes_tmp (id, remind_before_minutes)
SELECT id, NULL
FROM user_tasks;

ALTER TABLE user_tasks
ADD COLUMN remind_before_minutes INTEGER;

UPDATE user_tasks
SET remind_before_minutes = utrbm.remind_before_minutes
FROM user_tasks_remind_before_minutes_tmp utrbm
WHERE user_tasks.id = utrbm.id;

DROP TABLE user_tasks_remind_before_minutes_tmp;

ALTER TABLE user_tasks
ALTER COLUMN remind_before_minutes SET DEFAULT NULL;

-- Для удобства можно добавить индекс, если ожидается частый поиск по этому полю
-- CREATE INDEX IF NOT EXISTS idx_user_tasks_remind_before_minutes ON user_tasks(remind_before_minutes);
