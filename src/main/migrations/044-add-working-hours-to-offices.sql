-- Add working hours to offices table

ALTER TABLE public.offices
ADD COLUMN IF NOT EXISTS working_hours_start TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS working_hours_end TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS auto_track_enabled BOOLEAN DEFAULT false;

-- Update existing offices with default working hours if needed
UPDATE public.offices
SET 
  working_hours_start = COALESCE(working_hours_start, '08:00:00'),
  working_hours_end = COALESCE(working_hours_end, '18:00:00'),
  auto_track_enabled = COALESCE(auto_track_enabled, false)
WHERE working_hours_start IS NULL OR working_hours_end IS NULL;

