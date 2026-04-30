BEGIN;

CREATE TABLE cabinet_email_merge_verification (
    id            BIGSERIAL PRIMARY KEY,
    account_id    BIGINT      NOT NULL UNIQUE REFERENCES cabinet_account (id) ON DELETE CASCADE,
    peer_account_id BIGINT    NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    code_hash     TEXT        NOT NULL,
    masked_email  VARCHAR(320) NOT NULL,
    attempts_left INTEGER     NOT NULL DEFAULT 5,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cabinet_email_merge_verification_expires
    ON cabinet_email_merge_verification (expires_at);

COMMIT;
