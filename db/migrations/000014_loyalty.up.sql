CREATE TABLE loyalty_tier
(
    id                BIGSERIAL PRIMARY KEY,
    sort_order        INTEGER      NOT NULL,
    xp_min            BIGINT       NOT NULL,
    discount_percent  INTEGER      NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

CREATE INDEX idx_loyalty_tier_xp_min ON loyalty_tier (xp_min);

ALTER TABLE customer
    ADD COLUMN loyalty_xp BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN customer.loyalty_xp IS 'Накопленный XP лояльности (1 XP = 1 ₽ эквивалента по правилам начисления)';

-- Дефолтный сид: вариант B из docs/loyalty/progression-examples.md
INSERT INTO loyalty_tier (sort_order, xp_min, discount_percent)
VALUES (0, 0, 0),
       (1, 500, 2),
       (2, 1000, 4),
       (3, 2000, 6),
       (4, 4000, 8),
       (5, 7000, 10);
