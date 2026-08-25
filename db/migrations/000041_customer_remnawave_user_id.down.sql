DROP INDEX IF EXISTS idx_customer_remnawave_user_id;

ALTER TABLE customer
    DROP COLUMN IF EXISTS remnawave_short_uuid;

ALTER TABLE customer
    DROP COLUMN IF EXISTS remnawave_user_id;
