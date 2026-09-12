-- Добавляем поле service_category_id в таблицу registration_requests
ALTER TABLE registration_requests 
ADD COLUMN service_category_id INTEGER REFERENCES service_categories(id);

-- Создаем индекс для оптимизации запросов
CREATE INDEX idx_registration_requests_service_category_id ON registration_requests(service_category_id);
