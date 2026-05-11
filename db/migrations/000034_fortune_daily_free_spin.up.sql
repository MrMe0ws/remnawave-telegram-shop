-- Различение «разовый первый бесплатный» и «ежедневный бесплатный» спин колеса.
ALTER TABLE fortune_spins
    ADD COLUMN IF NOT EXISTS is_daily_free BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fortune_spins.is_daily_free IS 'true = бесплатный спин по FORTUNE_DAILY_FREE_SPIN за UTC-сутки; false = платный или исторический разовый бесплатный (до удаления режима)';
