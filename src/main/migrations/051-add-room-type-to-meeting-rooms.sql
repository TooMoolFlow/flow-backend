-- Add room_type column to meeting_rooms to distinguish meeting rooms and cabinets

ALTER TABLE public.meeting_rooms
ADD COLUMN IF NOT EXISTS room_type VARCHAR(20) NOT NULL DEFAULT 'meeting'
    CHECK (room_type IN ('meeting', 'cabinet'));

-- Helpful index for filtering by room_type
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_room_type
    ON public.meeting_rooms (room_type);

