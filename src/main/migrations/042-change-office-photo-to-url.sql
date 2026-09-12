-- Изменяем тип колонки photo с TEXT на VARCHAR(255) для хранения URL
ALTER TABLE offices
    ALTER COLUMN photo TYPE VARCHAR(255);

