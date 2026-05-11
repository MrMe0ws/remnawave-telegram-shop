-- Колесо фортуны: лог спинов + якорный промокод для pending-скидок (FK в customer_pending_discount).
INSERT INTO promo_code (
    code, type,
    subscription_days, trial_days, extra_hwid_delta,
    discount_percent, discount_ttl_hours, max_uses, uses_count, valid_until,
    active, first_purchase_only, require_customer_in_db, allow_trial_without_payment,
    discount_max_subscription_payments_per_customer, tariff_id
)
SELECT
    '__CABINET_FORTUNE__',
    'discount',
    NULL, NULL, NULL,
    0, NULL, NULL, 0, NULL,
    FALSE, FALSE, FALSE, TRUE,
    -1, NULL
WHERE NOT EXISTS (SELECT 1 FROM promo_code WHERE code = '__CABINET_FORTUNE__');

CREATE TABLE fortune_spins (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customer (id) ON DELETE CASCADE,
    spin_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reward_type     VARCHAR(32) NOT NULL,
    reward_value    INTEGER NOT NULL,
    cost_days       INTEGER NOT NULL DEFAULT 1,
    is_free_spin    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_fortune_spins_customer_time ON fortune_spins (customer_id, spin_at DESC);
