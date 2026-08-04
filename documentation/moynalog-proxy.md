# «Мой налог» через прокси (сервер вне РФ)

Если сервер за пределами РФ и доступ к `lknpd.nalog.ru` блокируется, можно направить **только** запросы «Мой налог» через HTTP или SOCKS5 прокси (например squid/gost на ВДС в РФ).

## Шаги

1. Убедитесь, что прокси доступен из контейнера бота (IP/порт, логин/пароль).
2. В `.env`:

```env
MOYNALOG_ENABLED=true
MOYNALOG_URL=https://lknpd.nalog.ru/api/v1
MOYNALOG_USERNAME=ваш_логин
MOYNALOG_PASSWORD=ваш_пароль
MOYNALOG_PROXY_URL=http://user:pass@ip:3128
```

Для SOCKS5:

```env
MOYNALOG_PROXY_URL=socks5://user:pass@ip:1080
```

3. Перезапустите бота:

```bash
docker compose down && docker compose up -d
```

Если `MOYNALOG_PROXY_URL` пустой — запросы идут напрямую.

## Какие оплаты уходят в «Мой налог»

`MOYNALOG_RECEIPT_FOR` — список через запятую: `yookassa`, `platega`, `crypto`.

- Не задана — по умолчанию yookassa и platega.
- Задана пустой строкой — ни один способ.

Подробности переменных — [env.md](./env.md).
