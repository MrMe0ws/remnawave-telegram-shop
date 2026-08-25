# Платежи, вебхуки и проверка статуса

## Поддерживаемые способы оплаты

| Система | Переключатель | Примечание |
|---------|---------------|------------|
| [YooKassa](https://yookassa.ru/developers/api) | `YOOKASA_ENABLED` | Карты / привычные методы YooKassa |
| [Platega](https://platega.io) | `PLATEGA_ENABLED` + флаги методов | СБП, карты, эквайринг, worldwide, crypto |
| [CryptoPay](https://help.crypt.bot/crypto-pay-api) | `CRYPTO_PAY_ENABLED` | Крипто через Crypto Bot |
| Telegram Stars | `TELEGRAM_STARS_ENABLED` | Оплата звёздами в Telegram |
| Tribute | `TRIBUTE_*` | **Deprecated** — не развивать, лучше не подключать к новым установкам |

Переменные — в [env.md](./env.md) (разделы оплат).

## HTTP-сервер бота

Порт задаётся `HEALTH_CHECK_PORT`. На нём же:

- `/healthcheck` — статус БД, Remnawave, версия сборки;
- при включённом кабинете — `/cabinet/*` и `/cabinet/api/*`;
- вебхуки оплат (если заданы пути в env).

Рекомендуется слушать порт локально (`127.0.0.1`) и пускать наружу только через reverse proxy. Пример — [reverse-proxy.md](./reverse-proxy.md).

## Вебхуки и поллинг (YooKassa / Platega)

В `YOOKASA_WEBHOOK_URL` и `PLATEGA_WEBHOOK_URL` указывайте **только путь** (суффикс), без домена — например `/yookassa-hook`.

| Значение | Поведение |
|----------|-----------|
| **Пусто** | Успешные оплаты подтверждаются **поллингом** (бот сам спрашивает статус у API по расписанию) |
| **Путь задан** | Платёжка может слать уведомление на `https://ваш-домен` + путь (через reverse proxy) |

**CryptoPay** в этом форке подтверждается поллингом.  
**Tribute** — отдельные `TRIBUTE_*` (см. [env.md](./env.md)); операционно не рекомендуется.

## Прокси для ЮKassa

Если сервер расположен там, откуда `api.yookassa.ru` доступен нестабильно, платежи
падают с `500` в кабинете, а в логах видно:

```
failed to send request: Post "https://api.yookassa.ru/v3/payments": net/http: TLS handshake timeout
```

Характерный признак — отказы **плавающие**: часть запросов проходит, часть отваливается
по таймауту. Проверить можно так (десять подряд `401` = путь чистый, `000` = потери):

```bash
for i in $(seq 1 10); do curl -s -o /dev/null -w '%{http_code}
' --max-time 8 https://api.yookassa.ru/v3/payments; done
```

Лечится переменной `YOOKASA_PROXY_URL`:

```env
YOOKASA_PROXY_URL=socks5://user:pass@host:1080
```

Поддерживаются `http://`, `https://` и `socks5://`, авторизация — в самом URL.
Пусто (по умолчанию) — прямое соединение, поведение не меняется.

> **Не используйте вместо этого глобальный `HTTPS_PROXY`.** Он уведёт в прокси и
> обращения бота к панели Remnawave по внутреннему адресу docker-сети, которые
> снаружи не резолвятся, — сломается вся работа с панелью. `YOOKASA_PROXY_URL`
> применяется только к запросам ЮKassa.

Клиент ЮKassa работает с таймаутом 30 секунд, поэтому зависший прокси не удерживает
HTTP-обработчик кабинета бесконечно.

## Platega: методы

При `PLATEGA_ENABLED=true` обязательны `PLATEGA_MERCHANT_ID`, `PLATEGA_SECRET` и хотя бы один флаг:

- `PLATEGA_SBP_ENABLED`
- `PLATEGA_CARDS_ENABLED`
- `PLATEGA_ACQUIRING_ENABLED`
- `PLATEGA_WORLDWIDE_ENABLED`
- `PLATEGA_CRYPTO_ENABLED`

## «Мой налог»

После успешной оплаты можно отправлять доход в API «Мой налог» (`MOYNALOG_*`).  
Если сервер вне РФ — см. [moynalog-proxy.md](./moynalog-proxy.md).
