-- Для БД, где уже применена 074 только с одним офисом: размножить каталог по всем офисам
-- Безопасно запускать повторно (идемпотентно)

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
