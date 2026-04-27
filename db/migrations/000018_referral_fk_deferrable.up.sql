BEGIN;

-- Отложенная проверка FK нужна при смене customer.telegram_id (promote web-only):
-- в одной транзакции обновляем telegram_id и строки referral (referrer_id/referee_id).

ALTER TABLE referral DROP CONSTRAINT IF EXISTS referral_referrer_id_fkey;
ALTER TABLE referral DROP CONSTRAINT IF EXISTS referral_referee_id_fkey;

ALTER TABLE referral
    ADD CONSTRAINT referral_referrer_id_fkey
        FOREIGN KEY (referrer_id)
            REFERENCES customer (telegram_id)
            ON DELETE CASCADE
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE referral
    ADD CONSTRAINT referral_referee_id_fkey
        FOREIGN KEY (referee_id)
            REFERENCES customer (telegram_id)
            ON DELETE CASCADE
            DEFERRABLE INITIALLY DEFERRED;

COMMIT;
