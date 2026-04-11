ALTER TABLE purchase DROP COLUMN IF EXISTS promo_code_id;
ALTER TABLE purchase DROP COLUMN IF EXISTS discount_percent_applied;

DROP TABLE IF EXISTS customer_pending_discount;
DROP TABLE IF EXISTS promo_redemption;
DROP TABLE IF EXISTS promo_code;
