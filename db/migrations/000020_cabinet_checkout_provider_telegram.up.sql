ALTER TABLE cabinet_checkout
  DROP CONSTRAINT IF EXISTS cabinet_checkout_provider_chk;

ALTER TABLE cabinet_checkout
  ADD CONSTRAINT cabinet_checkout_provider_chk
  CHECK (provider IN ('yookassa', 'cryptopay', 'telegram'));
