DROP INDEX IF EXISTS idx_purchase_tariff_id;

ALTER TABLE purchase
    DROP COLUMN IF EXISTS is_early_downgrade,
    DROP COLUMN IF EXISTS purchase_kind,
    DROP COLUMN IF EXISTS tariff_id;

ALTER TABLE customer
    DROP COLUMN IF EXISTS subscription_period_months,
    DROP COLUMN IF EXISTS subscription_period_start,
    DROP COLUMN IF EXISTS current_tariff_id;

DROP TABLE IF EXISTS tariff_price;
DROP TABLE IF EXISTS tariff;
