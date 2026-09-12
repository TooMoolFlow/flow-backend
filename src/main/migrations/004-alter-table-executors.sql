ALTER TABLE executors
    ADD COLUMN department_id INTEGER NOT NULL;

ALTER TABLE executors
    ADD CONSTRAINT fk_executors_department
        FOREIGN KEY (department_id)
            REFERENCES users(id)
            ON DELETE CASCADE;