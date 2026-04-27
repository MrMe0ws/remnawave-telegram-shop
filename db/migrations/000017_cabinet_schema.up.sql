-- 000017_cabinet_schema.up.sql
--
-- Миграция подготавливает схему для web-кабинета (cabinet_*-таблицы) и добавляет
-- в существующую таблицу customer всё необходимое для web-only клиентов.
--
-- Схема соответствует docs/cabinet/mvp-tz.md раздел 7.1.
-- Этапы аудита использования telegram_id — docs/cabinet/audit-telegram-id.md.

BEGIN;

-- ============================================================================
-- 1) customer: колонка is_web_only + замена hash-индекса на btree + partial-index
-- ============================================================================

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS is_web_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Hash-индекс из 000001 не поддерживает range-запросы; startup-check и аудит
-- ожидают btree. IF EXISTS — чтобы миграция не падала, если где-то индекс уже
-- пересоздавали руками.
DROP INDEX IF EXISTS idx_customer_telegram_id;
CREATE INDEX IF NOT EXISTS idx_customer_telegram_id_btree
    ON customer (telegram_id);

-- Partial-index для дешёвого исключения web-only клиентов из broadcast/notify.
CREATE INDEX IF NOT EXISTS idx_customer_web_only
    ON customer (id)
    WHERE is_web_only = TRUE;

-- ============================================================================
-- 2) cabinet_account — главный аккаунт кабинета
-- ============================================================================

CREATE TABLE cabinet_account (
    id                BIGSERIAL PRIMARY KEY,
    email             VARCHAR(320),
    email_verified_at TIMESTAMPTZ,
    password_hash     TEXT,
    language          VARCHAR(8)  NOT NULL DEFAULT 'ru',
    status            VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at     TIMESTAMPTZ,
    CONSTRAINT cabinet_account_status_chk   CHECK (status IN ('active', 'blocked')),
    CONSTRAINT cabinet_account_language_chk CHECK (language IN ('ru', 'en'))
);

-- Email уникален case-insensitive там, где задан. NULL допускается (OAuth-only,
-- Telegram Login без email), и несколько NULL не конфликтуют благодаря partial-index.
CREATE UNIQUE INDEX idx_cabinet_account_email_unique
    ON cabinet_account (LOWER(email))
    WHERE email IS NOT NULL;

-- ============================================================================
-- 3) cabinet_identity — провайдеры входа, привязанные к аккаунту
-- ============================================================================

CREATE TABLE cabinet_identity (
    id               BIGSERIAL PRIMARY KEY,
    account_id       BIGINT       NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    provider         VARCHAR(32)  NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email   VARCHAR(320),
    raw_profile_json JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT cabinet_identity_provider_chk CHECK (provider IN ('email', 'telegram', 'google')),
    CONSTRAINT cabinet_identity_provider_unique UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_cabinet_identity_account
    ON cabinet_identity (account_id);

-- ============================================================================
-- 4) cabinet_session — refresh-сессии с ротацией и reuse-detection
-- ============================================================================

CREATE TABLE cabinet_session (
    id                      BIGSERIAL   PRIMARY KEY,
    account_id              BIGINT      NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    refresh_token_hash      BYTEA       NOT NULL UNIQUE,
    refresh_token_family_id UUID        NOT NULL,
    user_agent              TEXT,
    ip                      INET,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ NOT NULL,
    revoked_at              TIMESTAMPTZ,
    rotated_to_session_id   BIGINT REFERENCES cabinet_session (id) ON DELETE SET NULL
);

CREATE INDEX idx_cabinet_session_account
    ON cabinet_session (account_id);

CREATE INDEX idx_cabinet_session_family
    ON cabinet_session (refresh_token_family_id);

-- Отдельный partial-index на «живые» сессии, чтобы дешево считать/выбирать
-- активные сессии аккаунта без сканирования отозванных.
CREATE INDEX idx_cabinet_session_active
    ON cabinet_session (account_id)
    WHERE revoked_at IS NULL;

-- ============================================================================
-- 5) cabinet_account_customer_link — связь аккаунта и клиента бота
-- ============================================================================

CREATE TABLE cabinet_account_customer_link (
    id          BIGSERIAL   PRIMARY KEY,
    account_id  BIGINT      NOT NULL UNIQUE REFERENCES cabinet_account (id) ON DELETE CASCADE,
    customer_id BIGINT      NOT NULL REFERENCES customer (id) ON DELETE CASCADE,
    link_status VARCHAR(32) NOT NULL DEFAULT 'linked',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cabinet_link_status_chk CHECK (link_status IN ('linked', 'pending_merge', 'rejected'))
);

CREATE INDEX idx_cabinet_link_customer
    ON cabinet_account_customer_link (customer_id);

-- ============================================================================
-- 6) cabinet_merge_audit — журнал link/merge операций (включая dry-run)
-- ============================================================================

CREATE TABLE cabinet_merge_audit (
    id                 BIGSERIAL   PRIMARY KEY,
    account_id         BIGINT      NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    source_customer_id BIGINT,
    target_customer_id BIGINT,
    actor              VARCHAR(16) NOT NULL,
    result             VARCHAR(16) NOT NULL,
    reason             TEXT,
    dry_run            BOOLEAN     NOT NULL DEFAULT FALSE,
    idempotency_key    VARCHAR(64) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cabinet_merge_audit_actor_chk  CHECK (actor  IN ('user', 'system', 'admin')),
    CONSTRAINT cabinet_merge_audit_result_chk CHECK (result IN ('linked', 'merged', 'dry_run', 'rejected')),
    CONSTRAINT cabinet_merge_audit_idem_unique UNIQUE (account_id, idempotency_key)
);

CREATE INDEX idx_cabinet_merge_audit_account
    ON cabinet_merge_audit (account_id);

-- ============================================================================
-- 7) cabinet_email_verification — коды подтверждения email
-- ============================================================================

CREATE TABLE cabinet_email_verification (
    id         BIGSERIAL   PRIMARY KEY,
    account_id BIGINT      NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    token_hash BYTEA       NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cabinet_email_verification_account
    ON cabinet_email_verification (account_id);

-- ============================================================================
-- 8) cabinet_password_reset_token — сброс пароля
-- ============================================================================

CREATE TABLE cabinet_password_reset_token (
    id         BIGSERIAL   PRIMARY KEY,
    account_id BIGINT      NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    token_hash BYTEA       NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cabinet_password_reset_account
    ON cabinet_password_reset_token (account_id);

-- ============================================================================
-- 9) cabinet_checkout — идемпотентная корреляция web-checkout ↔ purchase
-- ============================================================================

CREATE TABLE cabinet_checkout (
    id              BIGSERIAL   PRIMARY KEY,
    account_id      BIGINT      NOT NULL REFERENCES cabinet_account (id) ON DELETE CASCADE,
    idempotency_key VARCHAR(64) NOT NULL UNIQUE,
    purchase_id     BIGINT REFERENCES purchase (id) ON DELETE SET NULL,
    provider        VARCHAR(32) NOT NULL,
    return_url      TEXT,
    status          VARCHAR(32) NOT NULL DEFAULT 'new',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cabinet_checkout_provider_chk CHECK (provider IN ('yookassa', 'cryptopay')),
    CONSTRAINT cabinet_checkout_status_chk   CHECK (status   IN ('new', 'pending', 'paid', 'failed', 'expired'))
);

CREATE INDEX idx_cabinet_checkout_account
    ON cabinet_checkout (account_id);

CREATE INDEX idx_cabinet_checkout_purchase
    ON cabinet_checkout (purchase_id)
    WHERE purchase_id IS NOT NULL;

COMMIT;
