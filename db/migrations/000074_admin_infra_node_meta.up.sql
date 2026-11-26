-- Инфраструктура в админке: то, чего не хранит панель Remnawave.
-- 1) Цена и период оплаты ноды — чтобы подставлять сумму и считать прогноз.
-- 2) Какие ноды покрыла запись истории оплат: в панели запись привязана только
--    к провайдеру, а один счёт часто оплачивает несколько серверов.
-- Ключи — UUID из панели (node_uuid ноды, uuid записи истории), внешних ключей нет:
-- сами объекты живут в панели. Имя и страну ноды держим копией, чтобы история
-- читалась и после удаления ноды из биллинга.

BEGIN;

CREATE TABLE admin_infra_node_meta (
    node_uuid     UUID          PRIMARY KEY,
    price         NUMERIC(12,2) CHECK (price IS NULL OR price >= 0),
    period_months SMALLINT      NOT NULL DEFAULT 1 CHECK (period_months BETWEEN 1 AND 24),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_infra_payment_nodes (
    history_uuid UUID          NOT NULL,
    node_uuid    UUID          NOT NULL,
    node_name    VARCHAR(255)  NOT NULL DEFAULT '',
    country_code VARCHAR(8)    NOT NULL DEFAULT '',
    amount       NUMERIC(12,2),
    billed_at    TIMESTAMPTZ   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (history_uuid, node_uuid)
);

CREATE INDEX idx_admin_infra_payment_nodes_node ON admin_infra_payment_nodes (node_uuid, billed_at DESC);

COMMIT;
