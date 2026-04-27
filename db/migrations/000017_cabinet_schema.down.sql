-- 000017_cabinet_schema.down.sql
--
-- Откатывает 000017_cabinet_schema.up.sql.
-- Порядок: сначала таблицы, зависящие от cabinet_account (FK cascade всё равно
-- разрешает DROP в любом порядке, но явный обратный порядок полезен для
-- человеческого чтения и для случаев с кастомными FK без cascade в будущем).

BEGIN;

DROP TABLE IF EXISTS cabinet_checkout;
DROP TABLE IF EXISTS cabinet_password_reset_token;
DROP TABLE IF EXISTS cabinet_email_verification;
DROP TABLE IF EXISTS cabinet_merge_audit;
DROP TABLE IF EXISTS cabinet_account_customer_link;
DROP TABLE IF EXISTS cabinet_session;
DROP TABLE IF EXISTS cabinet_identity;
DROP TABLE IF EXISTS cabinet_account;

-- Возвращаем состояние индексов customer к состоянию из 000001.
DROP INDEX IF EXISTS idx_customer_web_only;
DROP INDEX IF EXISTS idx_customer_telegram_id_btree;
CREATE INDEX IF NOT EXISTS idx_customer_telegram_id
    ON customer USING hash (telegram_id);

ALTER TABLE customer
    DROP COLUMN IF EXISTS is_web_only;

COMMIT;
