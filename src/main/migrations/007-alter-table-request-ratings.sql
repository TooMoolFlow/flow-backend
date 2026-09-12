ALTER TABLE request_ratings
DROP CONSTRAINT IF EXISTS request_ratings_request_id_key;

ALTER TABLE request_ratings
    ADD CONSTRAINT unique_request_rating_per_user UNIQUE (request_id, rated_by);

