ALTER TABLE loyalty_tier
    ADD COLUMN display_name TEXT NULL;

COMMENT ON COLUMN loyalty_tier.display_name IS 'Подпись уровня для пользователя (опционально; если NULL — показывается номер уровня)';
