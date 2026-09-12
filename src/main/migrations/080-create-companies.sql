-- Companies (арендаторы / организации внутри офиса)

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_office_id ON companies(office_id);

-- Уникальность названия компании внутри офиса (без учёта регистра и пробелов)
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_office_name_lower
    ON companies (office_id, LOWER(TRIM(name)));
