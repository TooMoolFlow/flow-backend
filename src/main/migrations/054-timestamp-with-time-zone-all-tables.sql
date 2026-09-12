-- Приведение всех колонок «момента времени» к TIMESTAMP WITH TIME ZONE (UTC).
-- Существующие значения трактуем как UTC (без сдвига); новые записи при timezone '+00:00' в Sequelize будут корректны.
-- Логика бронирований (meetingRoomBooking.service.js): границы дня и слоты используют +05:00 (Asia/Almaty),
-- создание брони — parseDateRange с +05:00, сравнения с now() и между датами остаются корректными.

-- notification_logs
ALTER TABLE notification_logs
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- rating_logs
ALTER TABLE rating_logs
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- client_ratings
ALTER TABLE client_ratings
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

-- registration_requests
ALTER TABLE registration_requests
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- request_photos
ALTER TABLE request_photos
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- fcm_tokens
ALTER TABLE fcm_tokens
  ALTER COLUMN last_used TYPE TIMESTAMP WITH TIME ZONE USING last_used AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

-- users (created_at из 011)
ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- meeting_rooms
ALTER TABLE meeting_rooms
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

-- meeting_room_bookings (включая время бронирования и служебные метки)
ALTER TABLE meeting_room_bookings
  ALTER COLUMN start_time TYPE TIMESTAMP WITH TIME ZONE USING start_time AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN end_time TYPE TIMESTAMP WITH TIME ZONE USING end_time AT TIME ZONE 'Asia/Almaty',
  ALTER COLUMN reminder_sent_at TYPE TIMESTAMP WITH TIME ZONE USING reminder_sent_at AT TIME ZONE 'UTC',
  ALTER COLUMN attendance_confirmed_at TYPE TIMESTAMP WITH TIME ZONE USING attendance_confirmed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

-- meeting_room_booking_logs
ALTER TABLE meeting_room_booking_logs
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';

-- activity_stats
ALTER TABLE activity_stats
  ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';

-- users.email_verification_code_expires_at (046) — если колонка есть
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verification_code_expires_at'
  ) THEN
    EXECUTE 'ALTER TABLE users ALTER COLUMN email_verification_code_expires_at TYPE TIMESTAMP WITH TIME ZONE USING email_verification_code_expires_at AT TIME ZONE ''UTC''';
  END IF;
END $$;
