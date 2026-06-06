BEGIN;

ALTER TABLE cabinet_support_message
    DROP CONSTRAINT IF EXISTS cabinet_support_message_delivery_status_chk;

ALTER TABLE cabinet_support_message
    DROP COLUMN IF EXISTS delivery_status;

COMMIT;
