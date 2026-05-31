-- Таблица для dedup lifecycle-уведомлений
CREATE TABLE customer_lifecycle_notify_sent (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    reference_key TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (customer_id, kind, reference_key)
);

CREATE INDEX idx_lifecycle_notify_kind_sent ON customer_lifecycle_notify_sent (kind, sent_at);
CREATE INDEX idx_lifecycle_notify_customer ON customer_lifecycle_notify_sent (customer_id);

-- Системный промокод для win-back (неактивный, служит FK для pending_discount)
-- CONSTRAINT uq_promo_code_upper требует uppercase для code
INSERT INTO promo_code (
    code, 
    type, 
    discount_percent, 
    active, 
    first_purchase_only, 
    require_customer_in_db
) VALUES (
    '__LIFECYCLE_WINBACK__',
    'discount',
    0,
    false,
    false,
    false
) ON CONFLICT (code) DO NOTHING;

-- Индексы для оптимизации lifecycle-запросов (no-connect, win-back)
-- No-connect paid/trial: фильтр (expire_at > NOW(), subscription_period_start < NOW() - interval)
CREATE INDEX IF NOT EXISTS idx_customer_expire_period 
    ON customer (expire_at, subscription_period_start) 
    WHERE expire_at IS NOT NULL AND subscription_period_start IS NOT NULL;

-- Win-back: фильтр (expire_at < NOW(), expire_at > NOW() - N дней)
CREATE INDEX IF NOT EXISTS idx_customer_expire_at_desc 
    ON customer (expire_at DESC) 
    WHERE expire_at IS NOT NULL;
