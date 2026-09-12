-- User tasks (To-Do with optional schedule/deadline)
CREATE TABLE IF NOT EXISTS user_tasks (
    id                SERIAL PRIMARY KEY,
    creator_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(500) NOT NULL,
    completed         BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at      TIMESTAMPTZ,
    scheduled_at      TIMESTAMPTZ,
    deadline_from     DATE,
    deadline_to       DATE,
    deadline_time     VARCHAR(5),
    remind_at         TIMESTAMPTZ,
    reminders_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_tasks_creator ON user_tasks(creator_id);
CREATE INDEX idx_user_tasks_scheduled ON user_tasks(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_user_tasks_completed ON user_tasks(completed);
CREATE INDEX idx_user_tasks_deadline ON user_tasks(deadline_to, deadline_time) WHERE deadline_to IS NOT NULL;

-- Assignees for team tasks
CREATE TABLE IF NOT EXISTS user_task_assignees (
    user_task_id      INTEGER NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (user_task_id, user_id)
);

CREATE INDEX idx_user_task_assignees_user ON user_task_assignees(user_id);
