-- Обновляем внешний ключ для service_category_id в таблице registration_requests
-- чтобы при удалении категории поле становилось NULL вместо ошибки

-- Сначала удаляем существующий внешний ключ
ALTER TABLE registration_requests 
DROP CONSTRAINT IF EXISTS registration_requests_service_category_id_fkey;

-- Создаем новый внешний ключ с ON DELETE SET NULL
ALTER TABLE registration_requests 
ADD CONSTRAINT registration_requests_service_category_id_fkey 
FOREIGN KEY (service_category_id) 
REFERENCES service_categories(id) 
ON DELETE SET NULL;
