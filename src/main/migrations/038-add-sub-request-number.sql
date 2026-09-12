-- Добавляем поле sub_request_number в таблицу requests
ALTER TABLE requests ADD COLUMN sub_request_number INTEGER;

-- Обновляем существующие записи, устанавливая номера подзаявок
-- Для каждой группы заявок нумеруем подзаявки по порядку создания
WITH numbered_requests AS (
    SELECT 
        id,
        request_group_id,
        ROW_NUMBER() OVER (PARTITION BY request_group_id ORDER BY created_date, id) as row_num
    FROM requests
    WHERE sub_request_number IS NULL
)
UPDATE requests 
SET sub_request_number = numbered_requests.row_num
FROM numbered_requests
WHERE requests.id = numbered_requests.id;
