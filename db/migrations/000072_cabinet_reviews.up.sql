-- Отзывы клиентов: один отзыв на аккаунт кабинета, модерация, ответ команды.

BEGIN;

CREATE TABLE cabinet_review (
    id            BIGSERIAL PRIMARY KEY,
    -- NULL — отзыв от имени клиента, который ни разу не заходил в кабинет (бот-пользователь).
    account_id    BIGINT       REFERENCES cabinet_account (id) ON DELETE CASCADE,
    customer_id   BIGINT       REFERENCES customer (id) ON DELETE SET NULL,
    rating        SMALLINT     NOT NULL,
    body          TEXT         NOT NULL,
    -- Текст до первой тихой правки админом: виден только в админке.
    original_body TEXT         NOT NULL DEFAULT '',
    status        VARCHAR(16)  NOT NULL,
    visibility    VARCHAR(16)  NOT NULL,
    display_name  VARCHAR(120) NOT NULL DEFAULT '',
    -- Откуда брать аватар: '' — нет, 'telegram' — отдаём сами по id отзыва
    -- (ссылку с токеном не храним: она протухает), 'url' — внешняя картинка OAuth.
    avatar_kind   VARCHAR(16)  NOT NULL DEFAULT '',
    avatar_url    TEXT         NOT NULL DEFAULT '',
    telegram_id   BIGINT,
    client_since  DATE,
    tariff_label  VARCHAR(255) NOT NULL DEFAULT '',
    by_admin      BOOLEAN      NOT NULL DEFAULT FALSE,
    reply_body    TEXT         NOT NULL DEFAULT '',
    reply_at      TIMESTAMPTZ,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT cabinet_review_rating_chk CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT cabinet_review_status_chk CHECK (status IN ('pending', 'published', 'hidden')),
    CONSTRAINT cabinet_review_visibility_chk CHECK (visibility IN ('anonymous', 'name', 'name_avatar')),
    CONSTRAINT cabinet_review_avatar_kind_chk CHECK (avatar_kind IN ('', 'telegram', 'url')),
    CONSTRAINT cabinet_review_body_len_chk CHECK (char_length(body) BETWEEN 5 AND 1000),
    CONSTRAINT cabinet_review_reply_len_chk CHECK (char_length(reply_body) <= 1000)
);

CREATE UNIQUE INDEX idx_cabinet_review_account ON cabinet_review (account_id);
CREATE UNIQUE INDEX idx_cabinet_review_customer_noacc ON cabinet_review (customer_id) WHERE account_id IS NULL;
CREATE INDEX idx_cabinet_review_status_created ON cabinet_review (status, created_at DESC, id DESC);
CREATE INDEX idx_cabinet_review_published ON cabinet_review (published_at DESC, id DESC) WHERE status = 'published';

COMMIT;
