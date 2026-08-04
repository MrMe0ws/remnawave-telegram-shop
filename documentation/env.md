# Переменные окружения (`.env`)

Полный справочник. Шаблон с комментариями — [`.env.sample`](../.env.sample).  
Краткий минимум для старта — в [`readme.md`](../readme.md).

Часть ключей можно менять без рестарта через web-админку **«Настройки бота»** (`/cabinet/admin/settings`).  
Только через `.env` (+ рестарт): токены провайдеров, `MOYNALOG_*`, `LIFECYCLE_CRON`, вкл/выкл способов оплаты.

---

## Минимум для запуска бота

| Переменная | Зачем |
|------------|--------|
| `TELEGRAM_TOKEN` | Токен бота от [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` / `POSTGRES_*` | PostgreSQL |
| `REMNAWAVE_URL`, `REMNAWAVE_TOKEN` | Связь с панелью Remnawave |
| `PRICE_1` … `PRICE_12` | Цены (обязательны даже при `SALES_MODE=tariffs`) |
| `HEALTH_CHECK_PORT` | Порт HTTP (healthcheck / кабинет / вебхуки) |
| `ADMIN_TELEGRAM_ID` | Ваш Telegram ID — кнопка «Админ» |

Для кабинета дополнительно: `CABINET_ENABLED=true`, `CABINET_PUBLIC_URL`, `CABINET_JWT_SECRET`, SMTP/OAuth по гайду [`cabinet/SETUP-GUIDE-RU.md`](./cabinet/SETUP-GUIDE-RU.md).

---

## Режим продаж и цены

| Переменная | Описание |
|------------|----------|
| `SALES_MODE` | `classic` (цены из env) или `tariffs` (каталог в БД). Подробно — [sales-modes.md](./sales-modes.md) |
| `PRICE_1` … `PRICE_12` | Цена за 1 / 3 / 6 / 12 месяцев (₽) |
| `STARS_PRICE_1` … `STARS_PRICE_12` | Цена в Telegram Stars по периодам |
| `SHOW_LONG_TERM_SAVINGS_PERCENT` | На кнопках 3/6/12 мес показывать экономию «…₽ (-N%)». По умолчанию `false` |
| `RUB_PER_STAR` | Условный курс ₽ за 1 Star; в `tariffs` — расчёт Stars и XP лояльности |
| `DAYS_IN_MONTH` | Дней в месяце для расчётов срока |

---

## Telegram

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_TOKEN` | Bot API токен |
| `TELEGRAM_PROXY_URL` | Прокси для Bot API (`http://user:pass@ip:3128`). Пусто — напрямую |
| `DEFAULT_LANGUAGE` | Язык по умолчанию: `ru` или `en` |
| `IS_WEB_APP_LINK` | Показывать ссылку подписки как WebApp |
| `MINI_APP_URL` | URL Telegram Mini App; пусто — не используется |
| `GREETING_IMAGE` | Картинка главного меню: `http(s)://` или путь к файлу |
| `FORWARD_USER_MESSAGES_TO_ADMIN` | Пересылать админу сообщения пользователей (`true`/`false`) |
| `BLOCKED_TELEGRAM_IDS` | Telegram ID через запятую — блок доступа |
| `WHITELISTED_TELEGRAM_IDS` | ID, обходящие проверки на подозрительных пользователей |
| `ADMIN_TELEGRAM_ID` | ID админа: админка в боте и кабинете |

---

## База данных и сервис

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Строка подключения PostgreSQL |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Для docker-compose |
| `HEALTH_CHECK_PORT` | Порт HTTP-сервера бота |

---

## Remnawave

| Переменная | Описание |
|------------|----------|
| `REMNAWAVE_URL` | URL API панели |
| `REMNAWAVE_MODE` | `remote` или `local` (local — можно `http://remnawave:3000`) |
| `REMNAWAVE_TOKEN` | Токен API |
| `REMNAWAVE_HEADERS` | Доп. заголовки: `key1:value1;key2:value2` |
| `REMNAWAVE_TAG` | Тег пользователей в панели (`^[A-Z0-9_]+$`) |
| `TRIAL_REMNAWAVE_TAG` | Тег для триала; пусто — как `REMNAWAVE_TAG` |

Squads — [squads.md](./squads.md): `SQUAD_UUIDS`, `EXTERNAL_SQUAD_UUID`, `TRIAL_INTERNAL_SQUADS`, `TRIAL_EXTERNAL_SQUAD_UUID`.

---

## Оплата: YooKassa

| Переменная | Описание |
|------------|----------|
| `YOOKASA_ENABLED` | Вкл/выкл |
| `YOOKASA_SECRET_KEY` / `YOOKASA_SHOP_ID` / `YOOKASA_URL` / `YOOKASA_EMAIL` | Учётные данные API |
| `YOOKASA_WEBHOOK_URL` | Путь для вебхука (без домена). Пусто — только поллинг. См. [payments.md](./payments.md) |

---

## Оплата: Platega

| Переменная | Описание |
|------------|----------|
| `PLATEGA_ENABLED` | Вкл; при `true` обязательны merchant + secret и хотя бы один метод |
| `PLATEGA_MERCHANT_ID` / `PLATEGA_SECRET` | Учётные данные |
| `PLATEGA_WEBHOOK_URL` | Путь вебхука; пусто — поллинг |
| `PLATEGA_SBP_ENABLED` | СБП |
| `PLATEGA_CARDS_ENABLED` | Карты |
| `PLATEGA_ACQUIRING_ENABLED` | Эквайринг |
| `PLATEGA_WORLDWIDE_ENABLED` | Worldwide |
| `PLATEGA_CRYPTO_ENABLED` | Crypto-метод Platega |

---

## Оплата: CryptoPay и Stars

| Переменная | Описание |
|------------|----------|
| `CRYPTO_PAY_ENABLED` / `CRYPTO_PAY_TOKEN` / `CRYPTO_PAY_URL` | CryptoPay |
| `TELEGRAM_STARS_ENABLED` | Оплата Stars |
| `REQUIRE_PAID_PURCHASE_FOR_STARS` | Требовать оплату картой/криптой до Stars. По умолчанию `false` |

---

## Tribute (deprecated)

Не рекомендуется для новых установок. Если задан `TRIBUTE_WEBHOOK_URL` — остальные обязательны.

| Переменная | Описание |
|------------|----------|
| `TRIBUTE_WEBHOOK_URL` | Путь webhook, например `/example` |
| `TRIBUTE_API_KEY` | API-ключ из приложения Tribute |
| `TRIBUTE_PAYMENT_URL` | URL оплаты (ссылка подписки Telegram) |

---

## Уведомления о платежах (в группу)

| Переменная | Описание |
|------------|----------|
| `PAYMENTS_NOTIFY_ENABLED` | Вкл уведомления в Telegram-группу |
| `PAYMENTS_NOTIFY_CHAT_ID` | ID чата/группы |
| `PAYMENTS_NOTIFY_MESSAGE_THREAD_ID` | ID темы форума (0 — без темы) |
| `PAYMENTS_NOTIFY_EVENTS` | `paid`, `cancel` через запятую; пусто при вкл. = оба |

---

## Мой налог

| Переменная | Описание |
|------------|----------|
| `MOYNALOG_ENABLED` | Вкл интеграцию |
| `MOYNALOG_URL` | API (по умолчанию `https://lknpd.nalog.ru/api/v1`) |
| `MOYNALOG_USERNAME` / `MOYNALOG_PASSWORD` | Логин/пароль |
| `MOYNALOG_PROXY_URL` | Прокси http/https/socks5. См. [moynalog-proxy.md](./moynalog-proxy.md) |
| `MOYNALOG_RECEIPT_FOR` | Способы: `yookassa`, `platega`, `crypto`. Не задано = yookassa+platega. Пустая строка = никто |

---

## Трафик, триал, HWID

| Переменная | Описание |
|------------|----------|
| `TRAFFIC_LIMIT` | Лимит ГБ (0 — без лимита / по панели) |
| `TRAFFIC_LIMIT_RESET_STRATEGY` | `day` / `week` / `month` / `month_rolling` / `never` |
| `TRIAL_DAYS` | Дни триала; `0` = выкл |
| `TRIAL_TRAFFIC_LIMIT` | Лимит ГБ для триала |
| `TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY` | Стратегия сброса для триала |
| `TRIAL_ADD_TO_PAID` | Учитывать дни триала при покупке |
| `HWID_EXTRA_DEVICES_ENABLED` | Продажа доп. устройств в боте и кабинете. По умолчанию `true` |
| `HWID_ADD_PRICE` / `HWID_ADD_STARS_PRICE` | Цена за 1 доп. устройство |
| `HWID_MAX_DEVICE` | Макс. устройств в одной подписке |
| `TRIAL_HWID_LIMIT` | Лимит устройств на триале |
| `PAID_HWID_LIMIT` | Лимит на платной; `0` = `HWID_FALLBACK_DEVICE_LIMIT` |
| `HWID_FALLBACK_DEVICE_LIMIT` | Fallback, если в Remnawave лимит не задан (по умолчанию `2`) |

---

## Рефералы и лояльность

| Переменная | Описание |
|------------|----------|
| `REFERRAL_MODE` | `default` или `progressive` |
| `REFERRAL_DAYS` | Дни бонуса в `default`; `0` = выкл |
| `REFERRAL_FIRST_REFERRER_DAYS` | Дни пригласившему при первом пополнении реферала |
| `REFERRAL_FIRST_REFEREE_DAYS` | Дни новому пользователю при первом пополнении |
| `REFERRAL_REPEAT_REFERRER_DAYS` | Дни пригласившему за последующие пополнения |
| `LOYALTY_ENABLED` | Программа лояльности (скидки, XP, UI) |
| `LOYALTY_MAX_TOTAL_DISCOUNT_PERCENT` | Потолок лояльность% + промо% (1–100) |
| `LOYALTY_XP_MIN_PER_PURCHASE` | Минимум XP за оплату, если сумма не дала баллов (`0` = выкл) |

---

## Ссылки в меню бота

Пусто — кнопка скрыта. См. [customization.md](./customization.md).

| Переменная | Кнопка |
|------------|--------|
| `SERVER_STATUS_URL` | Статус сервера |
| `SUPPORT_URL` | Поддержка |
| `FEEDBACK_URL` | Отзывы |
| `CHANNEL_URL` | Канал |
| `TOS_URL` | Условия |
| `VIDEO_GUIDE_URL` | Видеоинструкция |
| `SERVER_SELECTION_URL` | Какой сервер выбрать |
| `PUBLIC_OFFER_URL` | Публичная оферта |
| `PRIVACY_POLICY_URL` | Политика конфиденциальности |
| `TERMS_OF_SERVICE_URL` | Пользовательское соглашение |

### Чат поддержки в кабинете

| Переменная | Описание |
|------------|----------|
| `SUPPORT_BOT_API` | Встроенный чат через bridge к telegram-support-bot (`false` по умолчанию) |
| `SUPPORT_BOT_API_URL` | Базовый URL API support-bot (обязателен при `true`) |
| `SUPPORT_BRIDGE_SECRET` | Общий секрет shop ↔ support-bot |
| `SUPPORT_LOGO_FILE` | Аватар поддержки в чате (опционально) |

Гайд: [`cabinet/SETUP-GUIDE-RU.md`](./cabinet/SETUP-GUIDE-RU.md) (раздел про support bridge).

---

## Lifecycle-уведомления

Подробности сценариев — [notifications.md](./notifications.md).

| Переменная | Описание |
|------------|----------|
| `LIFECYCLE_NOTIFY_ENABLED` | Главный переключатель |
| `LIFECYCLE_CRON` | Cron проверки (по умолчанию `*/30 * * * *`) |
| `LIFECYCLE_NO_CONNECT_PAID_ENABLED` | No-connect для оплативших |
| `LIFECYCLE_NO_CONNECT_TRIAL_ENABLED` | No-connect для триала |
| `LIFECYCLE_NO_CONNECT_DELAY_HOURS` | Мин. задержка после оплаты/триала |
| `LIFECYCLE_NO_CONNECT_MAX_AGE_HOURS` | Макс. окно отправки |
| `LIFECYCLE_WINBACK_ENABLED` | Win-back после просрочки |
| `LIFECYCLE_WINBACK_DAYS_AFTER_EXPIRY` | Через сколько дней после окончания |
| `LIFECYCLE_WINBACK_DISCOUNT_PERCENT` | % скидки в промокоде |
| `LIFECYCLE_WINBACK_DISCOUNT_TTL_HOURS` | TTL промокода (часы) |
| `LIFECYCLE_VIDEO_GUIDE_URL` | Видео в no-connect |
| `LIFECYCLE_SUPPORT_CONTACT` | Контакт в no-connect |

---

## Web-кабинет

Полный setup: [`cabinet/SETUP-GUIDE-RU.md`](./cabinet/SETUP-GUIDE-RU.md).

| Переменная | Описание |
|------------|----------|
| `CABINET_ENABLED` | Вкл web-кабинет |
| `CABINET_HTTP_ACCESS_LOG` | `minimal` / `full` / `off` — access-лог HTTP |
| `CABINET_PROFILE_DELETE_ENABLED` | Самоудаление профиля |
| `CABINET_PUBLIC_URL` | Публичный URL кабинета |
| `CABINET_ALLOWED_ORIGINS` | CORS allowlist |
| `CABINET_JWT_SECRET` | Секрет JWT (≥ 32 байт) |
| `CABINET_COOKIE_DOMAIN` | Домен refresh-cookie; пусто — из `CABINET_PUBLIC_URL` |
| `CABINET_ACCESS_TTL_MINUTES` / `CABINET_REFRESH_TTL_DAYS` | TTL токенов |
| `CABINET_WEB_TELEGRAM_ID_BASE` | База synthetic Telegram ID для web-only |
| `CABINET_BRAND_NAME` | Название в UI |
| `CABINET_BRAND_LOGO_URL` / `CABINET_BRAND_LOGO_FILE` / `CABINET_BRAND_LOGO_FILE_BASE` | Логотип |
| `CABINET_PWA_ENABLED` / `CABINET_PWA_APP_NAME` / `CABINET_PWA_SHORT_NAME` | PWA |
| `CABINET_LIGHT_THEME_ENABLED` | Светлая тема (`true` по умолчанию) |
| `CABINET_DECOR_THEME` | Декор: `off`, `green`, `neon`, `halloween`, … |
| `CABINET_TARIFF_PRICE_DISPLAY` | Витрина: `monthly` или `marketing` |
| `CABINET_DEEPLINK_HAPP_ENCRYPT` | Шифровать Happ deep link (`happ://crypt5/`) |
| `CABINET_DEEPLINK_INCY_ENCRYPT` | Обфусцировать INCY deep link (`incy://crypt1/`) |
| `CABINET_MINI_APP_URL` / `CABINET_MINI_APP_PATH` | Mini App для web↔telegram |
| `CABINET_TELEGRAM_UI_MODE` | `classic` или `minimalism` |
| `CABINET_TELEGRAM_SHOW_CHANNEL_BUTTON` | В minimalism — кнопка «Канал» |
| `CABINET_TELEGRAM_SHOW_FEEDBACK_BUTTON` | В minimalism — кнопка «Отзывы» |
| `CABINET_SMTP_*` / `CABINET_MAIL_FROM` | SMTP для verify/reset email |
| `CABINET_GOOGLE_*` / `CABINET_YANDEX_*` / `CABINET_VK_*` | OAuth |
| `CABINET_TELEGRAM_WEB_AUTH_MODE` | `oidc` (рекомендуется) или `widget` |
| `CABINET_TELEGRAM_LOGIN_BOT_USERNAME` / `CABINET_TELEGRAM_LOGIN_BOT_TOKEN` | Legacy Widget |
| `CABINET_TELEGRAM_OIDC_*` | Telegram OAuth 2.0 |
| `CABINET_TURNSTILE_*` | Cloudflare Turnstile |
| `CABINET_METRICS_USER` / `CABINET_METRICS_PASSWORD` | Basic-auth для `/cabinet/api/metrics` |

---

## Колесо фортуны

| Переменная | Описание |
|------------|----------|
| `FORTUNE_ENABLED` | Вкл колесо в кабинете |
| `FORTUNE_MAX_SPINS_PER_DAY` | Макс. платных спинов за UTC-сутки |
| `FORTUNE_SPIN_COST_DAYS` | Стоимость спина в днях подписки |
| `FORTUNE_MIN_SUBSCRIPTION_DAYS` | Мин. дней подписки для доступа |
| `FORTUNE_DAILY_FREE_SPIN` | Один бесплатный спин в сутки (UTC) |
| `FORTUNE_WINNER_TICKER_ENABLED` | Лента победителей на странице |
| `FORTUNE_WINNER_TICKER_FAKE_FILL` | `true` — только синтетическая лента |
| `FORTUNE_WEIGHT_*` | Веса секторов RNG |
| `FORTUNE_REWARD_*` | Величины призов (дни, XP, %) |

Конфиг в коде: `internal/cabinet/config/fortune_wheel.go`. Миграции `000033`, `000034`.

---

## Прочее

| Переменная | Описание |
|------------|----------|
| `DISABLE_ENV_FILE` | Не читать `.env` из файла (CI и т.п.) |

После правок `.env`:

```bash
docker compose up -d --force-recreate
```
