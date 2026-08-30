-- Партнёрская программа: денежный контур поверх продаж.
--
-- Реферальная программа платит ДНЯМИ подписки и живёт в referral /
-- referral_bonus_ledger. Партнёрская платит ДЕНЬГАМИ и по природе своей другая:
-- у неё есть баланс, холд, заявки на вывод и индивидуальные условия. Натянуть
-- это на referral нельзя — там нет ни денег, ни сущности «партнёр», ни статуса.
-- Поэтому отдельные таблицы, а не колонки к существующим.
--
-- Разграничение с рефералкой — на уровне приложения: клиент попадает либо в
-- partner_attribution, либо в referral, но никогда в обе. Иначе за одну оплату
-- заплатили бы дважды — деньгами партнёру и днями пригласившему.
--
-- Деньги везде NUMERIC(12,2), как purchase.amount и moynalog_receipt.amount:
-- копить рубли во float нельзя, а менять тип в существующих таблицах ради
-- новой фичи — нет.
--
-- Миграция строго аддитивная: пять новых таблиц, ни одного изменения
-- существующих. Откат на предыдущую версию бота безопасен — старый код о них
-- не знает.

-- Партнёр. Одна строка на клиента: партнёрство — свойство человека, а не
-- отдельный аккаунт, поэтому customer_id UNIQUE.
CREATE TABLE IF NOT EXISTS partner
(
    id                  BIGSERIAL PRIMARY KEY,
    customer_id         BIGINT         NOT NULL REFERENCES customer (id) ON DELETE CASCADE,

    -- pending — заявка подана, ждёт решения; active — работает и получает
    -- начисления; suspended — начисления идут, но вывод заблокирован (разбор
    -- подозрения на фрод); rejected — заявка отклонена.
    status              TEXT           NOT NULL DEFAULT 'pending',

    -- Индивидуальные условия. NULL — брать глобальные PARTNER_FIRST_PERCENT /
    -- PARTNER_RENEWAL_PERCENT. Именно NULL, а не 0: ноль — это осмысленное
    -- «ничего не платим», и отличать его от «как у всех» обязательно.
    first_percent       NUMERIC(5, 2)  NULL CHECK (first_percent IS NULL OR (first_percent >= 0 AND first_percent <= 100)),
    renewal_percent     NUMERIC(5, 2)  NULL CHECK (renewal_percent IS NULL OR (renewal_percent >= 0 AND renewal_percent <= 100)),
    -- NULL — брать глобальный PARTNER_MAX_LINKS.
    links_limit         INT            NULL CHECK (links_limit IS NULL OR links_limit > 0),

    -- Денежные остатки. Денормализация ради скорости экранов, но меняются
    -- ТОЛЬКО в одной транзакции со вставкой в partner_earning / partner_payout,
    -- поэтому сходятся с журналом. Сверка — запросом в админке.
    balance             NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    -- Начислено, но ещё не отлежало холд.
    hold_balance        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (hold_balance >= 0),
    -- Заморожено под неисполненную заявку на вывод. Без этого поля партнёр
    -- закажет вывод трижды подряд, пока админ обрабатывает первую заявку.
    reserved_balance    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (reserved_balance >= 0),
    total_earned        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_paid          NUMERIC(12, 2) NOT NULL DEFAULT 0,

    -- Реквизиты для выплаты. Хранятся текстом: способов много (СБП, карта,
    -- крипта), и каждый следующий не должен требовать миграции.
    payout_method       TEXT           NULL,
    payout_details      TEXT           NULL,

    -- Заявка. Отдельной таблицы нет намеренно: истории заявок не существует,
    -- повторная подача после отказа переписывает эти поля. Решение админа
    -- фиксируется в статусе и admin_note.
    app_about           TEXT           NULL,
    app_channels        TEXT           NULL,
    app_expected        TEXT           NULL,
    app_submitted_at    TIMESTAMPTZ    NULL,
    admin_note          TEXT           NULL,

    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    approved_at         TIMESTAMPTZ    NULL,
    -- Идентификатор администратора, принявшего решение: id аккаунта кабинета
    -- либо telegram_id, смотря откуда пришло действие. Без FK намеренно —
    -- источники разные, а админ может вообще не быть клиентом магазина.
    approved_by         BIGINT         NULL,

    CONSTRAINT partner_status_check
        CHECK (status IN ('pending', 'active', 'suspended', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_customer ON partner (customer_id);
CREATE INDEX IF NOT EXISTS idx_partner_status ON partner (status);

-- Ссылка партнёра. Личная ссылка и «поток» — одна сущность: поток отличается
-- только тем, что не помечен is_default. Две таблицы означали бы две логики
-- резолва кода и две реализации статистики.
CREATE TABLE IF NOT EXISTS partner_link
(
    id          BIGSERIAL PRIMARY KEY,
    partner_id  BIGINT      NOT NULL REFERENCES partner (id) ON DELETE CASCADE,
    -- Публичный код из ссылки: t.me/bot?start=p_<code> и кабинет ?p=<code>.
    -- Уникален глобально, поэтому по коду сразу известен и поток, и партнёр.
    code        TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    is_default  BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Архив вместо удаления для потоков, по которым уже кто-то пришёл: ссылка
    -- перестаёт работать для новых, но начисления и статистика остаются
    -- объяснимыми. Пустой поток удаляется физически: на него не ссылается ни
    -- одно закрепление и ни одно начисление.
    archived_at TIMESTAMPTZ NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT partner_link_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_partner_link_partner ON partner_link (partner_id);
-- Ровно одна ссылка по умолчанию на партнёра.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_link_default
    ON partner_link (partner_id) WHERE is_default;

-- Закрепление клиента за партнёром. customer_id первичный ключ: клиент
-- закрепляется один раз и навсегда (first touch). Повторный переход по чужой
-- ссылке ничего не меняет — иначе партнёры перекупали бы друг у друга уже
-- приведённую базу.
CREATE TABLE IF NOT EXISTS partner_attribution
(
    customer_id BIGINT      PRIMARY KEY REFERENCES customer (id) ON DELETE CASCADE,
    partner_id  BIGINT      NOT NULL REFERENCES partner (id) ON DELETE CASCADE,
    -- NO ACTION (по умолчанию), а не SET NULL: поток с приведёнными клиентами
    -- удалять нельзя, и это правило должно держать база, а не только код.
    --
    -- Именно NO ACTION, а не RESTRICT: при удалении партнёра каскад сносит и
    -- его ссылки, и его закрепления одним оператором, а RESTRICT проверяется
    -- немедленно и упал бы на полпути в зависимости от порядка каскадов.
    -- NO ACTION откладывает проверку до конца оператора — запрет на удаление
    -- «живого» потока остаётся, а каскадное удаление партнёра проходит.
    link_id     BIGINT      NULL REFERENCES partner_link (id),
    -- tg_start — переход по ссылке в боте; web — регистрация в кабинете;
    -- admin — привязка руками.
    source      TEXT        NOT NULL,
    attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT partner_attribution_source_check
        CHECK (source IN ('tg_start', 'web', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_partner_attribution_partner
    ON partner_attribution (partner_id, attached_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_attribution_link
    ON partner_attribution (link_id);

-- Журнал начислений. Единственный источник правды про деньги: балансы в
-- partner — производные от него.
CREATE TABLE IF NOT EXISTS partner_earning
(
    id              BIGSERIAL PRIMARY KEY,
    partner_id      BIGINT         NOT NULL REFERENCES partner (id) ON DELETE CASCADE,
    -- Клиент и покупка могут исчезнуть, факт начисления — нет.
    customer_id     BIGINT         NULL REFERENCES customer (id) ON DELETE SET NULL,
    purchase_id     BIGINT         NULL REFERENCES purchase (id) ON DELETE SET NULL,
    -- NO ACTION по той же причине, что и в partner_attribution.
    link_id         BIGINT         NULL REFERENCES partner_link (id),

    -- Сумма платежа как она есть в purchase, вместе с валютой: партнёр должен
    -- уметь пересчитать начисление сам, иначе любой спор упирается в «поверьте».
    base_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    base_currency   TEXT           NOT NULL DEFAULT 'RUB',
    -- Она же, приведённая к рублям (Stars — по RUB_PER_STAR на момент оплаты).
    base_amount_rub NUMERIC(12, 2) NOT NULL DEFAULT 0,
    -- Процент, действовавший в момент платежа. Хранится, чтобы смена настроек
    -- не переписывала прошлое задним числом.
    percent         NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    amount          NUMERIC(12, 2) NOT NULL,

    -- first — первая оплата приведённого клиента; renewal — все последующие;
    -- adjustment — ручная правка админом (возврат, компенсация, отмена).
    kind            TEXT           NOT NULL,
    -- hold — ждёт окончания холда; available — можно выводить;
    -- cancelled — снято (возврат, спорный платёж).
    status          TEXT           NOT NULL DEFAULT 'hold',
    hold_until      TIMESTAMPTZ    NULL,
    -- Причина для adjustment и cancelled: без неё лента операций не читается.
    note            TEXT           NULL,

    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    released_at     TIMESTAMPTZ    NULL,

    CONSTRAINT partner_earning_kind_check
        CHECK (kind IN ('first', 'renewal', 'adjustment')),
    CONSTRAINT partner_earning_status_check
        CHECK (status IN ('hold', 'available', 'cancelled'))
);

-- Структурная защита от двойного начисления. ProcessPurchaseById дёргается и
-- вебхуками, и поллерами; проверка статуса в коде спасает от гонки не всегда, а
-- задвоенная выплата — это реальные деньги. Ручные правки под правило не
-- попадают: их у одной покупки может быть сколько угодно.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_earning_purchase
    ON partner_earning (purchase_id)
    WHERE purchase_id IS NOT NULL AND kind <> 'adjustment';

CREATE INDEX IF NOT EXISTS idx_partner_earning_partner
    ON partner_earning (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_earning_customer
    ON partner_earning (customer_id);
CREATE INDEX IF NOT EXISTS idx_partner_earning_link
    ON partner_earning (link_id);
-- Выборка cron'ом раскрытия холда: только отлежавшие.
CREATE INDEX IF NOT EXISTS idx_partner_earning_due
    ON partner_earning (hold_until)
    WHERE status = 'hold';

-- Заявки на вывод. Перевод делается руками вне бота, здесь только учёт.
CREATE TABLE IF NOT EXISTS partner_payout
(
    id               BIGSERIAL PRIMARY KEY,
    partner_id       BIGINT         NOT NULL REFERENCES partner (id) ON DELETE CASCADE,
    amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),

    -- pending — ждёт админа; approved — принята, перевод в процессе;
    -- paid — деньги отправлены; rejected — отказ, сумма вернулась на баланс.
    status           TEXT           NOT NULL DEFAULT 'pending',
    method           TEXT           NULL,
    -- Снимок реквизитов на момент заявки: партнёр поменяет телефон завтра, а
    -- знать, куда отправляли вчера, нужно всегда.
    details_snapshot TEXT           NULL,
    admin_comment    TEXT           NULL,
    -- Номер перевода или чека — единственное доказательство в споре «денег не
    -- приходило».
    external_ref     TEXT           NULL,

    requested_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    processed_at     TIMESTAMPTZ    NULL,
    -- Кто обработал заявку; без FK по той же причине, что и partner.approved_by.
    processed_by     BIGINT         NULL,

    CONSTRAINT partner_payout_status_check
        CHECK (status IN ('pending', 'approved', 'paid', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_partner_payout_partner
    ON partner_payout (partner_id, requested_at DESC);
-- Очередь необработанных заявок в админке.
CREATE INDEX IF NOT EXISTS idx_partner_payout_open
    ON partner_payout (requested_at)
    WHERE status IN ('pending', 'approved');
