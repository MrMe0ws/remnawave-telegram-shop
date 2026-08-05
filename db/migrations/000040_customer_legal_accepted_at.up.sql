ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMPTZ NULL;

-- Существующие пользователи считаются уже согласившимися (дата создания аккаунта).
UPDATE customer
SET legal_accepted_at = COALESCE(created_at, now())
WHERE legal_accepted_at IS NULL;
