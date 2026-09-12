ALTER TABLE users
    ADD COLUMN service_category_id INTEGER;

ALTER TABLE users
    ADD CONSTRAINT fk_users_service_category
        FOREIGN KEY (service_category_id)
            REFERENCES service_categories(id)
            ON DELETE SET NULL;