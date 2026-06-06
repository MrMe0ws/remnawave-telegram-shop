-- 000036_cabinet_support.up.sql — чат поддержки из web-кабинета (bridge к support-боту).

BEGIN;

CREATE TABLE cabinet_support_ticket (
    id                    BIGSERIAL PRIMARY KEY,
    account_id            BIGINT       NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    support_bot_ticket_id BIGINT,
    status                VARCHAR(16)  NOT NULL DEFAULT 'open',
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    closed_at             TIMESTAMPTZ,
    CONSTRAINT cabinet_support_ticket_status_chk CHECK (status IN ('open', 'closed'))
);

CREATE UNIQUE INDEX idx_cabinet_support_ticket_one_open
    ON cabinet_support_ticket (account_id)
    WHERE status = 'open';

CREATE INDEX idx_cabinet_support_ticket_account
    ON cabinet_support_ticket (account_id, created_at DESC);

CREATE TABLE cabinet_support_message (
    id                     BIGSERIAL PRIMARY KEY,
    ticket_id              BIGINT       NOT NULL REFERENCES cabinet_support_ticket (id) ON DELETE CASCADE,
    direction              VARCHAR(8)   NOT NULL,
    text                   TEXT         NOT NULL,
    author_label           VARCHAR(255) NOT NULL DEFAULT '',
    support_bot_message_id BIGINT,
    client_message_id      UUID,  -- idempotency key для исходящих сообщений от пользователя
    delivery_status        VARCHAR(16) NOT NULL DEFAULT 'sent',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    read_at                TIMESTAMPTZ,
    CONSTRAINT cabinet_support_message_direction_chk CHECK (direction IN ('in', 'out')),
    CONSTRAINT cabinet_support_message_delivery_status_chk CHECK (delivery_status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX idx_cabinet_support_message_ticket
    ON cabinet_support_message (ticket_id, created_at ASC, id ASC);

CREATE UNIQUE INDEX idx_cabinet_support_message_sb_msg
 ON cabinet_support_message (support_bot_message_id)
 WHERE support_bot_message_id IS NOT NULL;

-- Idempotency key для исходящих сообщений пользователя (защита от дублей при retry)
CREATE UNIQUE INDEX idx_cabinet_support_message_client_msg
 ON cabinet_support_message (client_message_id)
 WHERE client_message_id IS NOT NULL;

-- Индекс для быстрого lookup по support_bot_ticket_id в webhook'ах
CREATE INDEX idx_cabinet_support_ticket_sb_ticket
 ON cabinet_support_ticket (support_bot_ticket_id)
 WHERE support_bot_ticket_id IS NOT NULL;

COMMIT;
