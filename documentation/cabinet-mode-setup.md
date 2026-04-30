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

Затем соберите бинарь бота (`go build` в корне репозитория).

Для Docker актуальный `Dockerfile` уже содержит отдельный stage сборки `web/cabinet` и автоматически подхватывает новые изменения SPA при `docker build`.

Собранные файлы попадают в `internal/cabinet/web/dist/` и должны быть актуальными к моменту `go build`, иначе в бинарнике не окажется свежего JS/CSS и SPA не откроется.

### Runtime-контент без ребилда

- Для контентных файлов кабинета используется runtime-чтение из volume `translations`:
  - `GET /cabinet/api/content/faq` → `/translations/cabinet/FAQ.json`
  - `GET /cabinet/api/content/app-config` → `/translations/cabinet/app-config.json`
- Поэтому тексты/гайды можно менять локально в `./translations/cabinet/*.json` и применять без сборки нового образа (достаточно, чтобы контейнер видел mount `./translations:/translations`).
- Страница установки устройств (`/cabinet/connections`) полностью зависит от `app-config.json` (платформы, порядок платформ, список приложений, шаги установки и кнопки).

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
- Turnstile (опционально): `CABINET_TURNSTILE_ENABLED`, `CABINET_TURNSTILE_SITE_KEY`, `CABINET_TURNSTILE_SECRET_KEY`.
- PWA (опционально): `CABINET_PWA_ENABLED`, `CABINET_PWA_APP_NAME`, `CABINET_PWA_SHORT_NAME`.

## 4. Соц-авторизация: Telegram, Google, Yandex, VK

1. В **BotFather** для бота задайте домен Mini App (`/setdomain`) на **тот же хост**, что и `CABINET_PUBLIC_URL`.
2. Для входа «через Telegram» с веб-страницы настройте **Telegram Login 2.0 (OIDC)** или legacy **Widget** — см. переменные `CABINET_TELEGRAM_WEB_AUTH_MODE`, `CABINET_TELEGRAM_OIDC_*`, `CABINET_TELEGRAM_LOGIN_BOT_USERNAME` в `.env.sample` и краткую инструкцию в **основном `readme.md`** (раздел Web-кабинет).
3. **Redirect URI** в BotFather должен **точно** совпадать с `CABINET_TELEGRAM_OIDC_REDIRECT_URL` (схема, хост, путь).
4. В link/merge UX учитывайте `provider` в query merge-страницы:
   - Google link conflict: `.../cabinet/link/merge?...&provider=google`
   - Telegram OIDC link conflict: `.../cabinet/link/merge?...&provider=telegram`
   - Yandex link conflict: `.../cabinet/link/merge?...&provider=yandex`
   - VK link conflict: `.../cabinet/link/merge?...&provider=vk`
   - Email merge_required: `.../cabinet/link/merge?provider=email`
   Это нужно, чтобы Merge Preview корректно отображал источник «найденного аккаунта».

### Google

- `CABINET_GOOGLE_CLIENT_ID`
- `CABINET_GOOGLE_CLIENT_SECRET`
- `CABINET_GOOGLE_REDIRECT_URL` (обычно `https://<домен>/cabinet/api/auth/google/callback`)
- В Google Cloud Console redirect URI должен совпадать с env **символ в символ**.

### Yandex OAuth

- `CABINET_YANDEX_CLIENT_ID`
- `CABINET_YANDEX_CLIENT_SECRET`
- `CABINET_YANDEX_REDIRECT_URL` (обычно `https://<домен>/cabinet/api/auth/yandex/callback`)
- В настройках приложения Яндекса добавьте тот же callback URL.

### VK OAuth

- `CABINET_VK_CLIENT_ID`
- `CABINET_VK_CLIENT_SECRET`
- `CABINET_VK_CLIENT_REDIRECT_URL` (обычно `https://<домен>/cabinet/api/auth/vk/callback`)
- В настройках VK приложения callback URL должен совпадать 1:1 с env.

### Поведение merge/link (сценарий B)

- При конфликте соц-identity или email во время привязки (`/accounts`) backend создаёт merge-claim.
- Пользователь отправляется в `link/merge`, где выбирает, какую подписку оставить, если активны обе.
- Логика `customer.telegram_id`/Remnawave при merge остаётся штатной: используется реальный Telegram ID, подписка и панельные данные не должны теряться.

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
- Если включён `CABINET_TURNSTILE_ENABLED=true`, backend требует Turnstile-токен (`X-Turnstile-Token`) на:
  - `POST /cabinet/api/auth/register`
  - `POST /cabinet/api/auth/login`
  - `POST /cabinet/api/auth/password/forgot`
- SPA поддерживает это автоматически: читает `turnstile_enabled` + `turnstile_site_key` из `GET /cabinet/api/auth/bootstrap`, запрашивает токен только при включённом флаге и добавляет заголовок только для этих маршрутов.
- При `CABINET_TURNSTILE_ENABLED=false` поведение auth-форм остаётся прежним (без Turnstile).
- Для rate-limit в cabinet не полагайтесь на клиентский `X-Forwarded-For`: проксируйте через trusted reverse proxy (nginx/caddy) и не публикуйте backend напрямую.
- `POST /cabinet/api/me/account/delete` в актуальной логике удаляет пользователя в Remnawave до удаления cabinet-account (если пользователь найден в панели), чтобы не оставлять «висячую» подписку.

## 9. Полезные ссылки в репозитории

- **`.env.sample`** — полный список переменных и комментарии.
- **`readme.md`** — обзор возможностей кабинета, OIDC micro guide, smoke-команды.
- **`documentation/cabinet-upgrade-guide.md`** — пошаговый upgrade-гайд (Dockerfile/Compose/.env/BotFather) для перехода с версии без кабинета.
- **`docs/cabinet/account-linking-and-merge.md`** — инварианты и контракт по привязке/merge (`google`/`telegram`/`email`).
- **`docs/cabinet/payments-and-checkout.md`** — контракты preview/create/finalize, Stars (`telegram` provider), idempotency и checkout UX.
- **`AGENTS.md`** (если есть в вашей ветке) — заметки для разработчиков (web-only, логи, метрики).

Если что-то из UI «не обновилось» после правок API — пересоберите `web/cabinet` и заново соберите бинарь, чтобы обновился `go:embed` dist.

Если меняли только `translations/cabinet/FAQ.json` или `translations/cabinet/app-config.json` и mount `/translations` подключён корректно, пересборка образа не требуется.
