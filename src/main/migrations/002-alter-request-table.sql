ALTER TABLE requests
    DROP COLUMN date_submitted;

ALTER TABLE requests
    ADD COLUMN date_submitted TIMESTAMP WITH TIME ZONE;
