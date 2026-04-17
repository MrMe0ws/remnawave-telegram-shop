-- Тарифы и цены (SALES_MODE=tariffs). При classic колонки остаются NULL / default.

CREATE TABLE tariff
(
    id                             BIGSERIAL PRIMARY KEY,
    slug                           VARCHAR(64)  NOT NULL UNIQUE,
    name                           VARCHAR(255),
    sort_order                     INTEGER      NOT NULL DEFAULT 0,
    is_active                      BOOLEAN      NOT NULL DEFAULT TRUE,
    device_limit                   INTEGER      NOT NULL DEFAULT 1,
    traffic_limit_bytes            BIGINT       NOT NULL DEFAULT 0,
    traffic_limit_reset_strategy   VARCHAR(32)  NOT NULL DEFAULT 'month',
    active_internal_squad_uuids    TEXT         NOT NULL DEFAULT '',
    external_squad_uuid            UUID,
    remnawave_tag                  VARCHAR(255),
    tier_level                     INTEGER,
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tariff_active_sort ON tariff (is_active, sort_order);

CREATE TABLE tariff_price
(
    id           BIGSERIAL PRIMARY KEY,
    tariff_id    BIGINT      NOT NULL REFERENCES tariff (id) ON DELETE RESTRICT,
    months       INTEGER     NOT NULL CHECK (months IN (1, 3, 6, 12)),
    amount_rub   INTEGER     NOT NULL,
    amount_stars INTEGER,
    UNIQUE (tariff_id, months)
);

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS current_tariff_id BIGINT REFERENCES tariff (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS subscription_period_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subscription_period_months INTEGER;

ALTER TABLE purchase
    ADD COLUMN IF NOT EXISTS tariff_id BIGINT REFERENCES tariff (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS purchase_kind VARCHAR(32) NOT NULL DEFAULT 'subscription',
    ADD COLUMN IF NOT EXISTS is_early_downgrade BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_purchase_tariff_id ON purchase (tariff_id) WHERE tariff_id IS NOT NULL;
