-- Create meeting_room_photos table for storing room photos (Cloudinary URLs)
CREATE TABLE IF NOT EXISTS public.meeting_room_photos (
    id              SERIAL PRIMARY KEY,
    meeting_room_id INTEGER      NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
    photo_url       VARCHAR(1024) NOT NULL,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_room_photos_meeting_room_id ON public.meeting_room_photos (meeting_room_id);
