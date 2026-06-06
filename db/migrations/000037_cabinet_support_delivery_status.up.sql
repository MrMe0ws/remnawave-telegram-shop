-- 000037: статус доставки исходящих сообщений пользователя (pending/sent/failed).

BEGIN;

ALTER TABLE cabinet_support_message
    ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(16) NOT NULL DEFAULT 'sent';

ALTER TABLE cabinet_support_message
    DROP CONSTRAINT IF EXISTS cabinet_support_message_delivery_status_chk;

ALTER TABLE cabinet_support_message
    ADD CONSTRAINT cabinet_support_message_delivery_status_chk
        CHECK (delivery_status IN ('pending', 'sent', 'failed'));

-- Существующие сообщения пользователя считаем доставленными.
UPDATE cabinet_support_message
SET delivery_status = 'sent'
WHERE direction = 'in';

COMMIT;
