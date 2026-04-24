ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(64);

COMMENT ON COLUMN customer.telegram_username IS 'Последний известный @username из Telegram (обновляется при активности пользователя в боте).';
