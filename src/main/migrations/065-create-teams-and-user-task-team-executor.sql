-- Teams (Этап 3: команды и назначение задач)
CREATE TABLE IF NOT EXISTS teams (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    leader_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);

CREATE TABLE IF NOT EXISTS team_members (
    team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Задачи: опциональная команда и исполнитель
ALTER TABLE user_tasks
    ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE user_tasks
    ADD COLUMN IF NOT EXISTS executor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_tasks_team_id ON user_tasks(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_executor_id ON user_tasks(executor_id) WHERE executor_id IS NOT NULL;
