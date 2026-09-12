-- Привязка компании к пользователям-клиентам и заявкам на регистрацию

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

ALTER TABLE registration_requests
    ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE registration_requests
    ADD COLUMN IF NOT EXISTS company_other_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_registration_requests_company_id ON registration_requests(company_id);
