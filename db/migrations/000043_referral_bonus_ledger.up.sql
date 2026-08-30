-- Журнал реферальных начислений.
--
-- До этой миграции нигде не хранилось, сколько дней реально начислено. Цифру
-- «заработано дней» каждый экран восстанавливал сам, пересчитывая её из таблицы
-- purchase по текущим настройкам — и делал это четырьмя независимыми
-- реализациями одной формулы:
--   referal.go:calculateEarnedDays        — карточка рефералки в боте и кабинете
--   referal.go:CalculateEarnedDays        — топ рефереров в админке бота
--   stats_repository.go:sumProgressiveReferrerDays — админ-статистика, progressive
--   stats_repository.go:referralBonusDaysRange     — она же, default
--
-- У пересчёта задним числом два неустранимых порока. Он врёт после любой правки
-- настроек: админ поднял REFERRAL_REPEAT_REFERRER_DAYS с 3 до 5 — и в истории
-- задним числом «выросли» начисления, которых никто не получал. И он ломается
-- ровно тогда, когда бонус перестаёт быть одним числом на все случаи: с
-- помесячным начислением восстановить прошлое из счётчика покупок уже нельзя,
-- нужны ставки, действовавшие в момент каждой оплаты.
--
-- Поэтому пишем факт. Строка добавляется только после успешного продления в
-- Remnawave, то есть журнал содержит выданное, а не задуманное.
--
-- Ключевые решения:
--   * recipient_telegram_id — кому достались дни. У начисления приглашённому
--     это он сам, у начисления пригласившему — пригласивший. Пара
--     referrer/referee при этом сохраняется в обоих случаях, поэтому «сколько
--     принёс вот этот реферал» и «сколько получил вот этот человек» — два
--     разных запроса к одной таблице, без объединений.
--   * first_month_days и per_month_days — для аудита. Без них строка на 22 дня
--     ничего не объясняет, а с ними видно, что это 7 за первый месяц плюс 3 за
--     каждый из пяти остальных, и отличить это от более поздней смены ставок.
--   * purchase_id NULL-абельный. Строки бэкфилла привязаны к покупке, но
--     будущие ручные компенсации админом — нет.
--   * Никакого UNIQUE(purchase_id): за одну оплату начисляется двоим (первая
--     оплата даёт дни и пригласившему, и приглашённому). Защита от дублей —
--     частичный уникальный индекс по паре «покупка + вид начисления».
--
-- Миграция строго аддитивная: одна новая таблица, ни одного изменения
-- существующих. Откат на предыдущую версию бота безопасен — старый код о
-- таблице не знает и продолжит считать статистику по-старому.

CREATE TABLE IF NOT EXISTS referral_bonus_ledger
(
    id                    BIGSERIAL PRIMARY KEY,

    -- Связь рефералов, по которой начислено. NULL, если строка referral
    -- удалена: сам факт начисления от этого не перестаёт быть фактом.
    referral_id           BIGINT      NULL REFERENCES referral (id) ON DELETE SET NULL,
    referrer_telegram_id  BIGINT      NOT NULL,
    referee_telegram_id   BIGINT      NOT NULL,

    -- Получатель дней.
    recipient_telegram_id BIGINT      NOT NULL,
    recipient_customer_id BIGINT      NULL REFERENCES customer (id) ON DELETE SET NULL,

    -- Оплата, породившая начисление.
    purchase_id           BIGINT      NULL REFERENCES purchase (id) ON DELETE SET NULL,
    -- Длина оплаченного периода в месяцах на момент начисления.
    months                INT         NOT NULL DEFAULT 0,

    -- Фактически начисленные дни и ставки, из которых они сложились:
    -- days = first_month_days + per_month_days * (months - 1) на первой оплате
    -- реферала и per_month_days * months на последующих.
    days                  INT         NOT NULL,
    first_month_days      INT         NOT NULL DEFAULT 0,
    per_month_days        INT         NOT NULL DEFAULT 0,

    -- first_referrer / first_referee — первая оплата приглашённого;
    -- repeat_referrer — его последующие оплаты;
    -- default_referrer — разовый бонус режима REFERRAL_MODE=default;
    -- manual — ручная компенсация админом.
    kind                  TEXT        NOT NULL,

    -- Строка восстановлена бэкфиллом по истории покупок, а не записана в момент
    -- начисления. Такие числа приблизительны: они посчитаны по настройкам,
    -- действующим на момент обновления бота, потому что настройки, бывшие в
    -- момент оплаты, нигде не сохранялись. У таких строк ставки за месяц
    -- нулевые: помесячного начисления тогда не существовало, и раскладывать
    -- плоский бонус на ставки значило бы выдумывать их задним числом.
    is_backfilled         BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Когда начислено. У бэкфилла — время оплаты, иначе разбивка статистики по
    -- дням и неделям свалила бы всю историю в день обновления.
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT referral_bonus_ledger_kind_check
        CHECK (kind IN ('first_referrer', 'first_referee', 'repeat_referrer', 'default_referrer', 'manual')),
    CONSTRAINT referral_bonus_ledger_days_check
        CHECK (days >= 0)
);

-- Защита от повторного начисления за ту же оплату: одна покупка — не более
-- одной строки каждого вида. Ручные компенсации под правило не попадают, их у
-- одной покупки может быть сколько угодно.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_bonus_ledger_purchase_kind
    ON referral_bonus_ledger (purchase_id, kind)
    WHERE purchase_id IS NOT NULL AND kind <> 'manual';

-- «Сколько дней получил этот человек» — карточка рефералки, топ рефереров.
CREATE INDEX IF NOT EXISTS idx_referral_bonus_ledger_recipient
    ON referral_bonus_ledger (recipient_telegram_id, created_at DESC);

-- «Сколько принесли рефералы этого пригласившего» — статистика по связке.
CREATE INDEX IF NOT EXISTS idx_referral_bonus_ledger_referrer
    ON referral_bonus_ledger (referrer_telegram_id, created_at DESC);

-- Разбивка админ-статистики по периодам (сегодня / неделя / месяц / год).
CREATE INDEX IF NOT EXISTS idx_referral_bonus_ledger_created
    ON referral_bonus_ledger (created_at DESC);
