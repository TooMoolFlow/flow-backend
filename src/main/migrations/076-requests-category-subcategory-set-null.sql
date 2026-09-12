-- Заявки: при удалении категории/подкатегории поля обнуляются, заявки сохраняются

ALTER TABLE requests
    DROP CONSTRAINT IF EXISTS requests_category_id_fkey;

ALTER TABLE requests
    ADD CONSTRAINT requests_category_id_fkey
        FOREIGN KEY (category_id)
            REFERENCES service_categories (id)
            ON DELETE SET NULL;

ALTER TABLE requests
    ADD COLUMN IF NOT EXISTS subcategory_id INTEGER;

ALTER TABLE requests
    DROP CONSTRAINT IF EXISTS requests_subcategory_id_fkey;

ALTER TABLE requests
    ADD CONSTRAINT requests_subcategory_id_fkey
        FOREIGN KEY (subcategory_id)
            REFERENCES service_subcategories (id)
            ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_requests_subcategory_id ON requests (subcategory_id);

-- Связать существующие заявки с подкатегориями по названию (title) и категории
UPDATE requests r
SET subcategory_id = ss.id
FROM service_subcategories ss
WHERE r.subcategory_id IS NULL
  AND r.category_id = ss.category_id
  AND TRIM(LOWER(r.title)) = TRIM(LOWER(ss.name));
