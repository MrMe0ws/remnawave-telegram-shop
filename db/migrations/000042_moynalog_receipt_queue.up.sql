-- Очередь чеков «Мой налог».
--
-- До этой миграции чек отправлялся синхронно после оплаты, и при ошибке
-- (простой ФНС, протухшая авторизация) он терялся навсегда: код только писал
-- лог и слал уведомление админу, повторов не было — доход приходилось вносить
-- в приложении руками.
--
-- Строка создаётся ДО HTTP-запроса (outbox), поэтому чек не теряется даже если
-- процесс упадёт между оплатой и отправкой.
--
-- Ключевые решения:
--   * operation_time — время ОПЛАТЫ (purchase.paid_at), а не время отправки.
--     Иначе платёж, отправленный после трёхдневного простоя, зарегистрируется
--     у ФНС задним числом не тем днём, а на стыке месяцев — не тем периодом.
--   * UNIQUE(purchase_id) — структурная защита от дублей: у API «Мой налог»
--     нет ключа идемпотентности, поэтому повторная отправка создала бы второй
--     доход. Дубль дохода хуже отсутствующего: налог считается дважды,
--     а аннулирование чека — ручная операция.
--
-- Миграция строго аддитивная: новая таблица, ни одного изменения существующих.
-- Откат на предыдущую версию бота безопасен — старый код о таблице не знает.

CREATE TABLE IF NOT EXISTS moynalog_receipt
(
    id              BIGSERIAL PRIMARY KEY,
    purchase_id     BIGINT      NOT NULL REFERENCES purchase (id) ON DELETE CASCADE,
    amount          NUMERIC(12, 2) NOT NULL,
    description     TEXT        NOT NULL,
    -- Время оплаты; уходит в API как operationTime.
    operation_time  TIMESTAMPTZ NOT NULL,
    -- pending — ждёт отправки; sent — принят ФНС; failed — исчерпан предельный
    -- возраст; cancelled — снят вручную (доход внесён в приложении).
    status          TEXT        NOT NULL DEFAULT 'pending',
    attempts        INT         NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT        NULL,
    -- ID чека, присвоенный ФНС; доказательство успеха и ключ для сверки.
    receipt_id      TEXT        NULL,
    -- Уже отправляли админу сигнал о проблеме по этой строке (чтобы во время
    -- многодневного простоя не слать сообщение на каждой попытке).
    alerted_at      TIMESTAMPTZ NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT moynalog_receipt_status_check
        CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

-- Один чек на покупку.
CREATE UNIQUE INDEX IF NOT EXISTS idx_moynalog_receipt_purchase
    ON moynalog_receipt (purchase_id);

-- Выборка очереди воркером: только ожидающие, по времени следующей попытки.
CREATE INDEX IF NOT EXISTS idx_moynalog_receipt_due
    ON moynalog_receipt (next_attempt_at)
    WHERE status = 'pending';
