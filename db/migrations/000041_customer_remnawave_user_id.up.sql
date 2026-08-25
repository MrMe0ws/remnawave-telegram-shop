-- Remnawave 3.0.0 удалил `uuid` у пользователя панели и точечный поиск
-- GET /api/users/by-telegram-id/{id}. Чтобы не резолвить клиента заново на
-- каждой операции (а на fallback-путях — полным сканом панели), храним
-- идентификатор панели рядом с клиентом.
--
-- Миграция СТРОГО аддитивная: только ADD COLUMN, ни одного UPDATE/DROP над
-- существующими данными. Заполнение — ленивое, при первом резолве клиента
-- новым кодом. Благодаря этому откат на предыдущую версию бота не требует
-- восстановления БД: старый код читает явный список колонок
-- (см. customerSelectColumns) и лишних колонок просто не видит.

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS remnawave_user_id BIGINT NULL;

ALTER TABLE customer
    ADD COLUMN IF NOT EXISTS remnawave_short_uuid TEXT NULL;

-- Один профиль панели не может принадлежать двум клиентам.
-- Частичный индекс: NULL-ы (ещё не заполненные) уникальности не мешают.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_remnawave_user_id
    ON customer (remnawave_user_id)
    WHERE remnawave_user_id IS NOT NULL;
