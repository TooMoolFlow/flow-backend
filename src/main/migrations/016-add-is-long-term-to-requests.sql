ALTER TABLE requests
    ADD COLUMN is_long_term BOOLEAN NOT NULL DEFAULT false;
