-- Мягкая отвязка OAuth/email: строка cabinet_identity остаётся, скрывается в UI до следующего входа.
ALTER TABLE cabinet_identity
    ADD COLUMN IF NOT EXISTS unlinked_at TIMESTAMPTZ;
