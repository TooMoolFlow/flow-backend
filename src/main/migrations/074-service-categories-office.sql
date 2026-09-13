-- Категории и подкатегории привязаны к офису; полный каталог копируется в каждый офис
ALTER TABLE service_categories
    ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE;

ALTER TABLE service_categories
    DROP CONSTRAINT IF EXISTS service_categories_name_key;

-- Сначала привязка по заявкам (где уже есть история)
UPDATE service_categories sc
SET office_id = sub.office_id
FROM (
    SELECT DISTINCT ON (r.category_id)
        r.category_id,
        rg.office_id
    FROM requests r
    INNER JOIN request_groups rg ON rg.id = r.request_group_id
    WHERE r.category_id IS NOT NULL
      AND rg.office_id IS NOT NULL
    ORDER BY r.category_id, rg.id DESC
) sub
WHERE sc.id = sub.category_id
  AND sc.office_id IS NULL;

-- Оставшиеся строки — на первый офис (временно, как источник шаблона)
UPDATE service_categories
SET office_id = (SELECT id FROM offices ORDER BY id ASC LIMIT 1)
WHERE office_id IS NULL
  AND EXISTS (SELECT 1 FROM offices);

-- Копия всех уникальных названий категорий в каждый офис
INSERT INTO service_categories (name, office_id)
SELECT DISTINCT src.name, o.id
FROM offices o
CROSS JOIN (SELECT DISTINCT name FROM service_categories) src
WHERE NOT EXISTS (
    SELECT 1
    FROM service_categories existing
    WHERE existing.office_id = o.id
      AND existing.name = src.name
);

-- Строки без office_id остаются только если на момент миграции ещё нет ни одного офиса
-- (свежая база) - им некого назначить, поэтому удаляем как устаревшие плейсхолдеры;
-- подкатегории удалятся каскадом (FOREIGN KEY ... ON DELETE CASCADE)
DELETE FROM service_categories WHERE office_id IS NULL;

ALTER TABLE service_categories
    ALTER COLUMN office_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_categories_office_name
    ON service_categories (office_id, name);

CREATE INDEX IF NOT EXISTS idx_service_categories_office_id
    ON service_categories (office_id);

-- Подкатегории
ALTER TABLE service_subcategories
    ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE;

UPDATE service_subcategories ss
SET office_id = sc.office_id
FROM service_categories sc
WHERE sc.id = ss.category_id
  AND ss.office_id IS NULL;

-- Копия подкатегорий: для каждой категории офиса — все подкатегории с тем же именем категории
INSERT INTO service_subcategories (name, category_id, office_id)
SELECT DISTINCT ON (sc_target.id, st.name)
    st.name,
    sc_target.id,
    sc_target.office_id
FROM service_categories sc_target
INNER JOIN service_categories sc_src
    ON sc_src.name = sc_target.name
INNER JOIN service_subcategories st
    ON st.category_id = sc_src.id
WHERE NOT EXISTS (
    SELECT 1
    FROM service_subcategories ss_existing
    WHERE ss_existing.category_id = sc_target.id
      AND ss_existing.name = st.name
)
ORDER BY sc_target.id, st.name, st.id;

ALTER TABLE service_subcategories
    ALTER COLUMN office_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_subcategories_office_category_name
    ON service_subcategories (office_id, category_id, name);

CREATE INDEX IF NOT EXISTS idx_service_subcategories_office_id
    ON service_subcategories (office_id);
