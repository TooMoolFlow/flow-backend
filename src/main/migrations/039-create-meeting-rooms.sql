-- Create meeting_rooms table to support Meeting Rooms feature
-- Matches Sequelize model defined in src/main/models/MeetingRoom.js
-- Uses underscored column names (created_at / updated_at)

CREATE TABLE IF NOT EXISTS public.meeting_rooms (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    floor        INTEGER      NOT NULL,
    capacity     INTEGER      NOT NULL,
    equipment    TEXT[]       NOT NULL DEFAULT '{}',
    photos       TEXT[]       NOT NULL DEFAULT '{}',
    status       VARCHAR(20)  NOT NULL DEFAULT 'available' CHECK (status IN ('available','booked')),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    description  TEXT,
    office_id    INTEGER      NULL REFERENCES public.offices(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_office_id ON public.meeting_rooms (office_id);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_status ON public.meeting_rooms (status);
CREATE INDEX IF NOT EXISTS idx_meeting_rooms_is_active ON public.meeting_rooms (is_active);

-- Optional trigger to auto-update updated_at on UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_meeting_rooms_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.meeting_rooms_set_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_meeting_rooms_set_updated_at
    BEFORE UPDATE ON public.meeting_rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.meeting_rooms_set_updated_at();
  END IF;
END$$;


