ALTER TABLE chat_messages RENAME TO request_comments;

ALTER TABLE request_comments
    RENAME COLUMN message_text TO comment;