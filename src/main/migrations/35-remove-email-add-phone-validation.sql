-- Обновляем телефоны, приводя их к формату +7 777 XXX XX XX
UPDATE users
SET phone = '+7 777 ' ||
            LPAD(((id / 10000) % 1000)::text, 3, '0') || ' ' ||
            LPAD(((id / 100) % 100)::text, 2, '0') || ' ' ||
            LPAD((id % 100)::text, 2, '0');

-- Удаляем поле email
ALTER TABLE users DROP COLUMN IF EXISTS email;

-- Обновляем поле phone, делая его обязательным
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- Добавляем проверку формата телефона
ALTER TABLE users ADD CONSTRAINT check_phone_format 
CHECK (phone ~ '^\+7 \d{3} \d{3} \d{2} \d{2}$');

-- Обновляем существующие записи, если нужно
-- (здесь можно добавить UPDATE для существующих записей)
