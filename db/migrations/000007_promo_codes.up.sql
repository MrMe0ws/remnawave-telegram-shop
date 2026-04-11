CREATE TABLE promo_code
(
    id                            BIGSERIAL PRIMARY KEY,
    code                          VARCHAR(64)  NOT NULL,
    type                          VARCHAR(32)  NOT NULL,
    subscription_days             INTEGER,
    trial_days                    INTEGER,
    extra_hwid_delta              INTEGER,
    discount_percent              INTEGER,
    discount_ttl_hours            INTEGER,
    max_uses                      INTEGER,
    uses_count                    INTEGER      NOT NULL DEFAULT 0,
    valid_until                   TIMESTAMP WITH TIME ZONE,
    active                        BOOLEAN      NOT NULL DEFAULT TRUE,
    first_purchase_only           BOOLEAN      NOT NULL DEFAULT FALSE,
    require_customer_in_db        BOOLEAN      NOT NULL DEFAULT FALSE,
    allow_trial_without_payment   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_promo_code_upper UNIQUE (code)
);

CREATE INDEX idx_promo_code_active ON promo_code (active);

CREATE TABLE promo_redemption
(
    id             BIGSERIAL PRIMARY KEY,
    promo_code_id  BIGINT NOT NULL REFERENCES promo_code (id) ON DELETE CASCADE,
    customer_id    BIGINT NOT NULL REFERENCES customer (id) ON DELETE CASCADE,
    used_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_promo_redemption_once UNIQUE (promo_code_id, customer_id)
);

CREATE INDEX idx_promo_redemption_promo ON promo_redemption (promo_code_id);
CREATE INDEX idx_promo_redemption_used_at ON promo_redemption (used_at);

CREATE TABLE customer_pending_discount
(
    id                  BIGSERIAL PRIMARY KEY,
    customer_id         BIGINT NOT NULL UNIQUE REFERENCES customer (id) ON DELETE CASCADE,
    promo_code_id       BIGINT NOT NULL REFERENCES promo_code (id) ON DELETE CASCADE,
    percent             INTEGER NOT NULL,
    expires_at          TIMESTAMP WITH TIME ZONE,
    until_first_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_pending_discount_customer ON customer_pending_discount (customer_id);

ALTER TABLE purchase
    ADD COLUMN IF NOT EXISTS promo_code_id BIGINT REFERENCES promo_code (id),
    ADD COLUMN IF NOT EXISTS discount_percent_applied INTEGER;
