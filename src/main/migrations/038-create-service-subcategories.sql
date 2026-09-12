-- Создание таблицы подкатегорий услуг
CREATE TABLE IF NOT EXISTS service_subcategories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER NOT NULL,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE
);

-- Создание индекса для быстрого поиска по category_id
CREATE INDEX IF NOT EXISTS idx_service_subcategories_category_id ON service_subcategories(category_id);

-- Вставка данных справочника
-- КТО категория
INSERT INTO service_categories (name) VALUES ('КТО') ON CONFLICT(name) DO NOTHING;
INSERT INTO service_categories (name) VALUES ('Клининг') ON CONFLICT(name) DO NOTHING;

-- Получаем ID категорий
-- КТО подкатегории
INSERT INTO service_subcategories (name, category_id) 
SELECT 'Замена ламп', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Ремонт мебели', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Ремонт Электрики', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Ремонт сантехники/протечка воды', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Вентилляция', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Кондиционирование /отопление', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Пурифайр (вода)', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Ремонт двери', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Ремонт пола', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Ремонт потолка', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Другое', id FROM service_categories WHERE name = 'КТО'
ON CONFLICT DO NOTHING;

-- Клининг подкатегории
INSERT INTO service_subcategories (name, category_id) 
SELECT 'Уборка пола', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Уборка кухонь', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Уборка санузла', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Мойка окон', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Мойка мебели', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Отсутствует Туалетная бумага', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Отсутствует бумажные полотенца', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Отсутствует мыло', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;

INSERT INTO service_subcategories (name, category_id) 
SELECT 'Другое', id FROM service_categories WHERE name = 'Клининг'
ON CONFLICT DO NOTHING;
