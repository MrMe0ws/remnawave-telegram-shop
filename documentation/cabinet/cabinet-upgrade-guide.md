# Переход на версию с Web-кабинетом

> **Где искать документацию по кабинету:** каталог **`documentation/cabinet/`** — индекс [`README.md`](README.md), полный запуск с нуля (домен, DNS, SSL, прокси, OAuth, Telegram auth, миграции, env, переводы) — **[`SETUP-GUIDE-RU.md`](SETUP-GUIDE-RU.md)**. Этот файл — только про **upgrade** уже работающего бота.

Этот гайд для установок, где уже работает Telegram-бот, и нужно безопасно перейти на релиз с модулем web-кабинета.

## ВАЖНО

- Кабинет включается только при `CABINET_ENABLED=true`. Пока `false`, бот работает в прежнем режиме.
- Перед запуском новой версии обязательно примените миграции БД (cabinet schema и последующие миграции по вашей ветке).
- `CABINET_PUBLIC_URL` должен быть реальным HTTPS-доменом кабинета и совпадать с настройками BotFather (`/setdomain`, OIDC redirect/origin).
- `CABINET_JWT_SECRET` должен быть длиной не менее 32 байт.
- В новой версии `Dockerfile` сам собирает SPA кабинета; отдельно запускать `npm run build` для Docker-сценария больше не нужно.
- После смены домена кабинета обязательно переустановите домен в BotFather, иначе web-login/mini app будут работать нестабильно.

## 1) Что изменилось архитектурно

- В одном сервисе работают:
  - Telegram-бот (как и раньше),
  - SPA кабинета по `GET /cabinet/*`,
  - API кабинета по `GET/POST /cabinet/api/*`.
- SPA вшивается в бинарник через `go:embed` из `internal/cabinet/web/dist`.
- При Docker-сборке `dist` теперь собирается автоматически в multi-stage `Dockerfile`.
- Runtime JSON-контент кабинета читается напрямую из `/translations/cabinet/*.json` (без ребилда образа):
  - `GET /cabinet/api/content/faq`
  - `GET /cabinet/api/content/app-config` (страница установки устройств `/cabinet/connections`).

## 2) Чеклист миграции

1. Сделайте backup PostgreSQL.
2. Обновите код/образ.
3. Примените миграции.
4. Обновите `.env` (блок `CABINET_*`).
5. Настройте reverse proxy и домен.
6. Настройте Telegram (OIDC/widget + `/setdomain`).
7. Пересоберите и перезапустите контейнеры.
8. Выполните smoke-проверки.

## 3) Обязательные переменные окружения

Минимальный набор для включения кабинета:

- `CABINET_ENABLED=true`
- `CABINET_PUBLIC_URL=https://cabinet.example.com`
- `CABINET_JWT_SECRET=<секрет>=32+ байт`

Рекомендуемый минимум для прода:

- `CABINET_ALLOWED_ORIGINS=https://cabinet.example.com`
- `CABINET_COOKIE_DOMAIN=` (пусто = хост из `CABINET_PUBLIC_URL`)
- `CABINET_ACCESS_TTL_MINUTES=15`
- `CABINET_REFRESH_TTL_DAYS=30`
- SMTP: `CABINET_SMTP_HOST`, `CABINET_SMTP_PORT`, `CABINET_SMTP_USER`, `CABINET_SMTP_PASSWORD`, `CABINET_MAIL_FROM`
- Telegram auth mode:
  - `CABINET_TELEGRAM_WEB_AUTH_MODE=oidc` (рекомендуется),
  - `CABINET_TELEGRAM_OIDC_CLIENT_ID`,
  - `CABINET_TELEGRAM_OIDC_CLIENT_SECRET`,
  - `CABINET_TELEGRAM_OIDC_REDIRECT_URL` (или пусто, чтобы вычислялся из `CABINET_PUBLIC_URL`).

Полный перечень переменных смотрите в `.env.sample`.

### Опционально: OAuth (Google, Яндекс, ВК)

Помимо email/password и Telegram web auth, кабинет поддерживает **вход и привязку через OAuth**: Google, **Яндекс ID** и **ВКонтакте**. Каждый провайдер включается, когда заданы **все три** переменные для него (client id, secret, redirect URL); иначе кнопки не показываются и эндпоинты не активируются.

- Google: `CABINET_GOOGLE_*`
- Яндекс: `CABINET_YANDEX_CLIENT_ID`, `CABINET_YANDEX_CLIENT_SECRET`, `CABINET_YANDEX_REDIRECT_URL`
- ВКонтакте: `CABINET_VK_CLIENT_ID`, `CABINET_VK_CLIENT_SECRET`, `CABINET_VK_CLIENT_REDIRECT_URL`

Список включённых провайдеров отдаёт `GET /cabinet/api/auth/bootstrap`. Подробная настройка редиректов и консолей разработчика — в **`SETUP-GUIDE-RU.md`** и комментариях **`.env.sample`**.

## 4) Dockerfile и Docker Compose

### Dockerfile

В проекте уже настроена авто-сборка кабинета:

- stage `cabinet_frontend` устанавливает зависимости `web/cabinet` и выполняет `npm run build`,
- stage `builder` копирует готовый `internal/cabinet/web/dist` и собирает Go-бинарник.

Это гарантирует, что изменения в `web/cabinet/src` попадают в контейнер при каждом `docker build`.

### Compose (рекомендуемый порядок)

Для локальной сборки:

```bash
docker compose -f docker-compose.dev.yaml build --no-cache
docker compose -f docker-compose.dev.yaml up -d --force-recreate
```

Для production-compose с локальной сборкой (если используете override):

```bash
docker compose build --no-cache
docker compose up -d --force-recreate
```

Если вы используете готовый образ из registry (`image: ...`), убедитесь, что в registry запушен образ из новой ревизии с обновлённым `Dockerfile`.

Важно для runtime-контента: в compose должен быть volume `./translations:/translations`, иначе `FAQ.json` и `app-config.json` не будут обновляться локально без пересборки образа.

## 5) Reverse proxy

Проксируйте весь кабинет в тот же backend-сервис:

- `/cabinet/`
- `/cabinet/api/`

И передавайте стандартные заголовки:

- `Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

Сервис слушает один HTTP-порт (`HEALTH_CHECK_PORT`).

## 6) Настройки Telegram (критично)

1. В BotFather выставьте `/setdomain` на домен кабинета.
2. Для OIDC:
   - добавьте `redirect_uri` = `CABINET_TELEGRAM_OIDC_REDIRECT_URL`,
   - добавьте `trusted origin` = `https://<домен-кабинета>`.
3. Убедитесь, что redirect URI совпадает побайтно (схема/хост/путь/слеши).

## 7) Рекомендуемое обновление со «старой» версии бота без кабинета (плавный запуск)

Такой порядок **предпочтителен для прода**: сначала новый код и миграции без публичного кабинета, затем явное включение модуля — **без простоя бота**.

1. Обновите код/образ и **примените миграции** при **`CABINET_ENABLED=false`** (кабинет в HTTP не отдаётся, бот ведёт себя как раньше).
2. Проверьте, что бот, платежи и админка стабильны.
3. Подготовьте `.env` по блоку `CABINET_*`, reverse proxy на `/cabinet/` и `/cabinet/api/`, при необходимости OAuth-приложения (Google / Яндекс / ВК) и Telegram — детальный чеклист в **`documentation/cabinet/SETUP-GUIDE-RU.md`**.
4. Включите **`CABINET_ENABLED=true`** и перезапустите сервис бота.
5. Выполните smoke-проверки: `bootstrap`, регистрация/логин (email, OAuth, Telegram web).

Если кабинет уже был включён и вы только обновляете версию, плавный запуск с `false`→`true` обычно не нужен — достаточно миграций и перезапуска с актуальным `.env`.

## 8) Smoke-проверки после обновления

```bash
curl -fsS "http://127.0.0.1:${HEALTH_CHECK_PORT}/healthcheck"
curl -fsS "http://127.0.0.1:${HEALTH_CHECK_PORT}/cabinet/api/healthz"
curl -fsS "http://127.0.0.1:${HEALTH_CHECK_PORT}/cabinet/api/auth/bootstrap"
```

Проверьте руками:

- открывается `/cabinet/`,
- логин/регистрация работают,
- checkout создаёт `checkout_id`,
- переход на `/cabinet/payment/status/{id}` работает,
- после оплаты статус меняется на `paid`.

## 9) Частые проблемы

- **Старый UI в контейнере:** используете старый image tag или не делаете `build --no-cache`.
- **Telegram OIDC не логинит:** не совпадает redirect URI/origin или забыли `/setdomain`.
- **401/CSRF в кабинете:** проверьте cookie domain/origins и HTTPS на прокси.
- **Кабинет не открывается:** `CABINET_ENABLED=false` или не проксируется `/cabinet/*`.
