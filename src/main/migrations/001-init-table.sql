CREATE TABLE IF NOT EXISTS offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    city VARCHAR(255) NOT NULL,
    address VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    office_id INT REFERENCES offices(id) ON DELETE SET NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'admin-worker', 'department-head', 'executor', 'manager'))
);

CREATE TABLE IF NOT EXISTS service_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS executors (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department_id INT REFERENCES users(id) ON DELETE SET NULL,
    office_id INT REFERENCES offices(id) ON DELETE SET NULL,
    location_detail VARCHAR(255),
    date_submitted TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    start_date DATE,
    end_date DATE
);


CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('normal', 'urgent', 'planned')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    client_id INT REFERENCES users(id) ON DELETE SET NULL,
    office_id INT REFERENCES offices(id) ON DELETE SET NULL,
    location_detail VARCHAR(255),
    date_submitted TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL CHECK (
        status IN (
                   'in_progress', 'execution', 'completed', 'rejected',
                   'awaiting_assignment', 'awaiting_sla', 'assigned'
            )
        ),
    category_id INT REFERENCES service_categories(id) ON DELETE SET NULL,
    complexity VARCHAR(50) CHECK (complexity IN ('simple', 'medium', 'complex')),
    sla VARCHAR(50),
    executor_id INT REFERENCES executors(id) ON DELETE SET NULL,
    admin_worker_id INT REFERENCES users(id) ON DELETE SET NULL,
    plan_id INT REFERENCES plans(id) ON DELETE SET NULL,
    actual_completion_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    comment TEXT
);

CREATE TABLE IF NOT EXISTS request_photos (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    photo_url VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('before', 'after'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    request_id INT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_ratings (
    id SERIAL PRIMARY KEY,
    request_id INT UNIQUE NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    rated_by INT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 0 AND rating <= 5),
    rated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);