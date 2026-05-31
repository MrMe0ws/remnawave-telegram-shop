-- Удаляем индексы сначала (порядок обратный up миграции)
DROP INDEX IF EXISTS idx_customer_expire_at_desc;
DROP INDEX IF EXISTS idx_customer_expire_period;

-- Удаляем таблицу и промокод
DROP TABLE IF EXISTS customer_lifecycle_notify_sent;

DELETE FROM promo_code WHERE code = '__LIFECYCLE_WINBACK__';
