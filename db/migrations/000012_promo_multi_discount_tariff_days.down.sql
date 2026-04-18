ALTER TABLE customer_pending_discount DROP COLUMN IF EXISTS subscription_payments_remaining;

ALTER TABLE promo_code DROP COLUMN IF EXISTS tariff_id;
ALTER TABLE promo_code DROP COLUMN IF EXISTS discount_max_subscription_payments_per_customer;
