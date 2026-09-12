-- Many-to-many: executor ↔ service categories
CREATE TABLE IF NOT EXISTS executor_service_categories (
    executor_id INTEGER NOT NULL REFERENCES executors(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (executor_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_executor_service_categories_category_id
    ON executor_service_categories(category_id);

-- Backfill: категория исполнителя = service_category_id его офис-менеджера (department-head)
-- executors.department_id → users.id руководителя, у которого ещё заполнен service_category_id
INSERT INTO executor_service_categories (executor_id, category_id)
SELECT e.id, dh.service_category_id
FROM executors e
INNER JOIN users dh ON dh.id = e.department_id
    AND dh.role = 'department-head'
    AND dh.service_category_id IS NOT NULL
ON CONFLICT (executor_id, category_id) DO NOTHING;

-- Department-head is office-scoped only
UPDATE users
SET service_category_id = NULL
WHERE role = 'department-head';
