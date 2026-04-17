CREATE TABLE admin_infra_billing_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    notify_before_1 BOOLEAN NOT NULL DEFAULT FALSE,
    notify_before_3 BOOLEAN NOT NULL DEFAULT FALSE,
    notify_before_7 BOOLEAN NOT NULL DEFAULT FALSE,
    notify_before_14 BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO admin_infra_billing_settings (id) VALUES (1);

CREATE TABLE admin_infra_billing_notify_sent (
    billing_uuid UUID NOT NULL,
    next_billing_at TIMESTAMPTZ NOT NULL,
    threshold_days SMALLINT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (billing_uuid, next_billing_at, threshold_days)
);

CREATE INDEX idx_admin_infra_billing_sent_sent_at ON admin_infra_billing_notify_sent (sent_at);
