-- User task attachments (photos/videos/documents)
CREATE TABLE IF NOT EXISTS public.user_task_attachments (
  id SERIAL PRIMARY KEY,
  user_task_id INTEGER NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
  uploaded_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url VARCHAR(2048) NOT NULL,
  file_name VARCHAR(255),
  mime_type VARCHAR(255),
  file_kind VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_task_attachments_task_id ON public.user_task_attachments (user_task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_attachments_uploaded_by_id ON public.user_task_attachments (uploaded_by_id);

-- User task attachments (photos/videos/docs)
CREATE TABLE IF NOT EXISTS public.user_task_attachments (
    id SERIAL PRIMARY KEY,
    user_task_id INTEGER NOT NULL REFERENCES user_tasks(id) ON DELETE CASCADE,
    uploaded_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_url VARCHAR(2048) NOT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(255),
    file_kind VARCHAR(20) NOT NULL CHECK (file_kind IN ('image', 'video', 'document')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_task_attachments_task_id ON public.user_task_attachments (user_task_id);
CREATE INDEX IF NOT EXISTS idx_user_task_attachments_uploaded_by_id ON public.user_task_attachments (uploaded_by_id);

