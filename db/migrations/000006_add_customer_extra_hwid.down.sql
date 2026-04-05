ALTER TABLE customer
    DROP COLUMN IF EXISTS extra_hwid,
    DROP COLUMN IF EXISTS extra_hwid_expires_at;
