ALTER TABLE promo_code
    ADD COLUMN IF NOT EXISTS discount_max_subscription_payments_per_customer INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS tariff_id BIGINT NULL REFERENCES tariff (id) ON DELETE SET NULL;

ALTER TABLE customer_pending_discount
    ADD COLUMN IF NOT EXISTS subscription_payments_remaining INTEGER NOT NULL DEFAULT 1;
