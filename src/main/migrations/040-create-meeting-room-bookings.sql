-- Create meeting_room_bookings and meeting_room_booking_logs to support calendar-based reservations

CREATE TABLE IF NOT EXISTS public.meeting_room_bookings (
    id                      SERIAL PRIMARY KEY,
    meeting_room_id         INTEGER      NOT NULL REFERENCES public.meeting_rooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
    office_id               INTEGER      NULL REFERENCES public.offices(id) ON UPDATE CASCADE ON DELETE SET NULL,
    client_id               INTEGER      NOT NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    start_time              TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time                TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','auto_cancelled')),
    company_name            VARCHAR(255),
    comment                 TEXT,
    reminder_sent_at        TIMESTAMP WITHOUT TIME ZONE,
    attendance_confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    cancelled_by            VARCHAR(50),
    cancellation_reason     TEXT,
    created_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_meeting_room_booking_times CHECK (start_time < end_time)
);

-- Indexes to speed up availability searches, calendars, and "my bookings" lists
CREATE INDEX IF NOT EXISTS idx_mrb_room_time ON public.meeting_room_bookings (meeting_room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_mrb_office_time ON public.meeting_room_bookings (office_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_mrb_client_time ON public.meeting_room_bookings (client_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_mrb_status_time ON public.meeting_room_bookings (status, start_time);
CREATE INDEX IF NOT EXISTS idx_mrb_company ON public.meeting_room_bookings (company_name);

-- Trigger to keep updated_at in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mrb_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.meeting_room_bookings_set_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_mrb_set_updated_at
    BEFORE UPDATE ON public.meeting_room_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.meeting_room_bookings_set_updated_at();
  END IF;
END$$;

-- Audit trail for lifecycle events
CREATE TABLE IF NOT EXISTS public.meeting_room_booking_logs (
    id          SERIAL PRIMARY KEY,
    booking_id  INTEGER     NOT NULL REFERENCES public.meeting_room_bookings(id) ON UPDATE CASCADE ON DELETE CASCADE,
    room_id     INTEGER     NOT NULL REFERENCES public.meeting_rooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
    office_id   INTEGER     NULL REFERENCES public.offices(id) ON UPDATE CASCADE ON DELETE SET NULL,
    actor_id    INTEGER     NULL REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
    actor_role  VARCHAR(50),
    action      VARCHAR(50) NOT NULL,
    from_status VARCHAR(20),
    to_status   VARCHAR(20),
    payload     JSONB,
    created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrbl_booking_id ON public.meeting_room_booking_logs (booking_id);
CREATE INDEX IF NOT EXISTS idx_mrbl_room_id ON public.meeting_room_booking_logs (room_id);
CREATE INDEX IF NOT EXISTS idx_mrbl_created_at ON public.meeting_room_booking_logs (created_at);

