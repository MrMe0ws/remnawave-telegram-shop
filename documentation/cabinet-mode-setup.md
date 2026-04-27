# Режим Web-кабинета (Cabinet): как включить и настроить

Web-кабинет — это **SPA + JSON API** в том же процессе, что и Telegram-бот. Пользователи могут регистрироваться по email, оплачивать подписку, смотреть статус и привязывать Telegram. Пока `CABINET_ENABLED=false`, бот ведёт себя как обычно, без поднятия маршрутов `/cabinet/*`.

## 1. Миграции базы данных

Убедитесь, что применены миграции с схемой кабинета (в репозитории: `db/migrations/000017_cabinet_schema*.sql` и последующие). Запускайте миграции тем же способом, что и для остального проекта (например, через ваш CI или вручную).

## 2. Сборка фронтенда (перед сборкой Go)

Встроенная SPA лежит в `internal/cabinet/web/dist` и подключается через `go:embed`. После изменений UI:

```bash
cd web/cabinet
npm ci
npm run build
```

Затем соберите бинарь бота (`go build` в корне репозитория). В Docker — добавьте этот шаг в Dockerfile до `go build`.

## 3. Обязательные переменные окружения

Все переменные с префиксом `CABINET_*` перечислены и прокомментированы в **`.env.sample`**. Минимум для включения режима:

| Переменная | Назначение |
|------------|------------|
| `CABINET_ENABLED` | `true` — включить кабинет |
| `CABINET_PUBLIC_URL` | Полный HTTPS-URL сайта кабинета, например `https://cabinet.example.com` (без завершающего `/`) |
| `CABINET_JWT_SECRET` | Секрет подписи access-JWT, **не короче 32 байт** (например `openssl rand -hex 32`) |

Обычно также задают:

- `CABINET_ALLOWED_ORIGINS` — CORS (часто совпадает с `CABINET_PUBLIC_URL`).
- `CABINET_COOKIE_DOMAIN` — домен для refresh-cookie; если пусто, берётся host из `CABINET_PUBLIC_URL`.
- SMTP (`CABINET_SMTP_*`, `CABINET_MAIL_FROM`) — если нужны подтверждение email и сброс пароля.

## 4. Telegram: Mini App и вход с сайта

1. В **BotFather** для бота задайте домен Mini App (`/setdomain`) на **тот же хост**, что и `CABINET_PUBLIC_URL`.
2. Для входа «через Telegram» с веб-страницы настройте **Telegram Login 2.0 (OIDC)** или legacy **Widget** — см. переменные `CABINET_TELEGRAM_WEB_AUTH_MODE`, `CABINET_TELEGRAM_OIDC_*`, `CABINET_TELEGRAM_LOGIN_BOT_USERNAME` в `.env.sample` и краткую инструкцию в **основном `readme.md`** (раздел Web-кабинет).
3. **Redirect URI** в BotFather должен **точно** совпадать с `CABINET_TELEGRAM_OIDC_REDIRECT_URL` (схема, хост, путь).

## 5. Reverse proxy и порт

Бот слушает **один** HTTP-порт (`HEALTH_CHECK_PORT` в `.env`). На него нужно проксировать **весь** сайт кабинета (и `/cabinet/`, и `/cabinet/api/`). Пример для nginx и TLS — в локальной копии **`docs/cabinet/deploy-guide-simple.md`** (если вы ведёте документацию у себя в `docs/`), либо настройте аналог: `proxy_pass` на `127.0.0.1:<порт>` с заголовками `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`.

## 6. Брендинг (название, логотип, favicon)

Опционально:

- `CABINET_BRAND_NAME` — текст в шапке и в футере страниц входа.
- `CABINET_BRAND_LOGO_URL` — URL картинки или путь относительно `CABINET_PUBLIC_URL`.
- `CABINET_BRAND_LOGO_FILE` — файл на диске процесса бота; отдаётся по `GET …/cabinet/api/public/brand-logo`. Относительный путь ищется **рядом с бинарником**, затем из cwd; в Docker при `WORKDIR=/` положите файл рядом с бинарём или задайте `CABINET_BRAND_LOGO_FILE_BASE` (см. `.env.sample`).

Иконка вкладки браузера подставляется из того же URL, что и логотип (если задан).

## 7. Проверка после старта

```bash
curl -fsS "http://127.0.0.1:${HEALTH_CHECK_PORT}/cabinet/api/healthz"
curl -fsS "http://127.0.0.1:${HEALTH_CHECK_PORT}/cabinet/api/auth/bootstrap"
```

Откройте в браузере `https://<ваш-домен>/cabinet/` — должна загрузиться страница входа.

## 8. Метрики и безопасность

- `GET /cabinet/api/metrics` — формат Prometheus; опционально Basic-auth через `CABINET_METRICS_USER` / `CABINET_METRICS_PASSWORD` (оба или ни одного).
- В CI рекомендуется скрипт `scripts/cabinet-forbid-sensitive-slogs.sh` — не логировать токены и `init_data` в кабинете.

## 9. Полезные ссылки в репозитории

- **`.env.sample`** — полный список переменных и комментарии.
- **`readme.md`** — обзор возможностей кабинета, OIDC micro guide, smoke-команды.
- **`AGENTS.md`** (если есть в вашей ветке) — заметки для разработчиков (web-only, логи, метрики).

Если что-то из UI «не обновилось» после правок API — пересоберите `web/cabinet` и заново соберите бинарь, чтобы обновился `go:embed` dist.
