BEGIN;

ALTER TABLE cabinet_identity DROP CONSTRAINT IF EXISTS cabinet_identity_provider_chk;
ALTER TABLE cabinet_identity
    ADD CONSTRAINT cabinet_identity_provider_chk
        CHECK (provider IN ('email', 'telegram', 'google', 'yandex', 'vk'));

COMMIT;
