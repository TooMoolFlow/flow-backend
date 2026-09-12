CREATE TABLE registration_requests (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  role VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_registration_requests_status ON registration_requests(status);
CREATE INDEX idx_registration_requests_office_id ON registration_requests(office_id);
CREATE INDEX idx_registration_requests_created_at ON registration_requests(created_at);
