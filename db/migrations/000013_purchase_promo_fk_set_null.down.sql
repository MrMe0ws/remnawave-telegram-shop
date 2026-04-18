ALTER TABLE purchase
    DROP CONSTRAINT IF EXISTS purchase_promo_code_id_fkey;
ALTER TABLE purchase
    ADD CONSTRAINT purchase_promo_code_id_fkey
        FOREIGN KEY (promo_code_id) REFERENCES promo_code (id);
