ALTER TABLE client_ratings DROP CONSTRAINT client_ratings_request_group_id_fkey;
ALTER TABLE client_ratings ADD CONSTRAINT client_ratings_request_group_id_fkey
    FOREIGN KEY (request_group_id) REFERENCES request_groups(id) ON DELETE CASCADE;

ALTER TABLE client_ratings DROP CONSTRAINT client_ratings_rated_by_fkey;
ALTER TABLE client_ratings ADD CONSTRAINT client_ratings_rated_by_fkey
    FOREIGN KEY (rated_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE client_ratings DROP CONSTRAINT client_ratings_client_id_fkey;
ALTER TABLE client_ratings ADD CONSTRAINT client_ratings_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;