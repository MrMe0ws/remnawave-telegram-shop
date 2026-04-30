# Remnawave Telegram Shop - Улучшенный Форк


<img width="auto" height="auto" alt="image" src="https://github.com/user-attachments/assets/eff4a209-873c-400e-9ff3-2ad7facf6c51" />
<img width="auto" height="auto" alt="image" src="https://github.com/user-attachments/assets/96d96a7f-4316-427c-b9c8-781c6f7213d7" />
<img width="auto" height="auto" alt="image" src="https://github.com/user-attachments/assets/216cdcbe-f88e-4830-a799-a8ae86585720" />
<img width="auto" height="auto" alt="image" src="https://github.com/user-attachments/assets/ebe300a8-55f0-4569-86ec-3af160a24bb4" />


## 🚀 Улучшенные Возможности

Это **улучшенный форк** оригинального бота Remnawave Telegram Shop с дополнительным функционалом:

### ✨ Добавленные Новые Функции:

- **📱 Управление устройствами**: отдельное меню, просмотр и удаление HWID устройств
- **➕ Доп. устройства**: покупка дополнительных слотов с пропорциональной оплатой
- **🔁 Продление с доп. устройствами**: выбор продления подписки с доп. устройствами одним платежом
- **👁️ Отслеживание Сообщений Админом**: Админ может видеть все сообщения и команды, отправленные пользователями боту
- **💬 Система Ответов Админа**: Админ может отвечать на пересланные сообщения пользователей напрямую из админского интерфейса
- **📚 Улучшенная Секция Помощи**: Реорганизованное главное меню с выделенной секцией Помощи, содержащей руководство по выбору сервера, поддержку, видеоинструкцию и условия использования
- **🔧 Лимит Устройств HWID по Умолчанию**: Настраиваемый лимит устройств по умолчанию, когда лимит устройств пользователя не установлен в Remnawave
- **🔄 Улучшенная Синхронизация**: Сохранение языка пользователя при синхронизации с Remnawave
- **📊 Информация о Версии**: Отображение версии, коммита и даты сборки в логах и healthcheck endpoint
- **⚡ Обновленный API**: Встроенный HTTP-клиент Remnawave для совместимости с 2.7.x
- **🎨 Кнопки с Emoji/Style**: Поддержка кастомных emoji и стилей inline-кнопок через переводы
- **🧭 Авто-ответ на Callback**: Автоматическое снятие "loading" у inline-кнопок
- **🧩 Прокси для Telegram**: Опциональный прокси для запросов Bot API
-  **🧩 Прокси для Мой Налог**: Опциональный прокси для запросов Bot API
- **🤝 Реферальная система (2 режима)**: Гибкая логика бонусов и расширенная статистика
- **🧾 История транзакций**: Просмотр последних оплат с пагинацией
- **📋 Список рефералов**: Отображение активных/неактивных рефералов
- **🎫 Промокоды**: ввод кода пользователем (дни подписки, триал, доп. устройства, скидка %), админка создания и управления промокодами, pending-скидка на следующую оплату, подсказки в «Мой VPN» и на экране тарифов
- **📦 Режим нескольких тарифов (`SALES_MODE=tariffs`)**: цены и лимиты (трафик, устройства, squads, описание) из PostgreSQL; пошаговый сценарий «Купить» (выбор тарифа → период → способ оплаты → оплата); админка тарифов; опциональное описание тарифа для экранов покупки и карточки в админке
- **👥 Админ — «Пользователи»** (`ADMIN_TELEGRAM_ID`): списки всех / неактивных, поиск, карточка; оплаты и сводка в ₽ + Stars (оценка Stars в ₽ при `RUB_PER_STAR`); ветка **«Подписки»** (все / скоро истекают); пагинация с выбором страницы. При **`SALES_MODE=tariffs`** — смена тарифа, доп. HWID, описание, устройства, настройки панели (squads, трафик, срок подписки и др.).
- **📈 Админ-статистика** (при заданном `ADMIN_TELEGRAM_ID`): раздел **«Статистика»** в админ-панели — пользователи, подписки, доходы в ₽ (фильтр по RUB/RUR/пустой валюте), реферальные начисления **в днях**, общая сводка; данные из PostgreSQL, кнопки «Обновить» / «Назад».
- **💎 Лояльность** (`LOYALTY_ENABLED`): XP по успешным оплатам (1 ₽ эквивалента ≈ 1 XP, Stars через `RUB_PER_STAR`), уровни и скидки в таблице `loyalty_tier` (миграция `000014_loyalty`), админка уровней и **пересчёт XP из истории `purchase`**, пользовательский экран в «Мой VPN». Подробнее — `docs/loyalty/` и `AGENTS.md`.

### 📋 Совместимость Версий:

- **Версия Бота**: 4.4.1
- **Поддержка Remnawave**: 2.7.\*
- **Функция HWID**: Совместимость с Remnawave 2.3.\*
- **Версионирование**: Информация о версии, коммите и дате сборки доступна в логах и healthcheck endpoint

---

[![Stars](https://img.shields.io/github/stars/Jolymmiels/remnawave-telegram-shop.svg?style=social)](https://github.com/Jolymmiels/remnawave-telegram-shop/stargazers)
[![Forks](https://img.shields.io/github/forks/Jolymmiels/remnawave-telegram-shop.svg?style=social)](https://github.com/Jolymmiels/remnawave-telegram-shop/network/members)
[![Issues](https://img.shields.io/github/issues/Jolymmiels/remnawave-telegram-shop.svg)](https://github.com/Jolymmiels/remnawave-telegram-shop/issues)

## Описание

Telegram бот для продажи подписок с интеграцией в Remnawave (https://remna.st/). Этот сервис позволяет пользователям
покупать и управлять подписками через Telegram с множественными вариантами платежных систем.

- [remnawave-api-go](https://github.com/Jolymmiles/remnawave-api-go)

## Команды Администратора

- `/sync` - Получить пользователей из remnawave и синхронизировать их с базой данных. Удалить всех пользователей, которых нет в remnawave.

### Платежные Системы

- [YooKassa API](https://yookassa.ru/developers/api)
- [CryptoPay API](https://help.crypt.bot/crypto-pay-api)
- Telegram Stars
- Tribute

## Возможности

- Покупка VPN подписок с различными способами оплаты (банковские карты, криптовалюта)
- Множественные планы подписок (1, 3, 6, 12 месяцев)
- Автоматизированное управление подписками
- **Уведомления о Подписках**: Бот автоматически отправляет уведомления пользователям за 3 дня до истечения их подписки,
  помогая им избежать прерывания сервиса
- Поддержка нескольких языков (русский и английский)
- **Селективное Назначение squad**: Настройка конкретных squad для назначения пользователям через фильтрацию UUID
- Все сообщения telegram поддерживают HTML форматирование https://core.telegram.org/bots/api#html-style
- Healthcheck - бот проверяет доступность базы данных и панели. Возвращает информацию о версии, коммите и дате сборки

### 🆕 Улучшенные Возможности (специфичные для форка):

- **Управление Устройствами**: Пользователи могут просматривать и управлять своими подключенными HWID устройствами
- **Мониторинг Админа**: Полная система отслеживания сообщений и ответов для администраторов
- **Улучшенный UI**: Реорганизованное главное меню с улучшенной секцией Помощи
- **Поддержка HWID**: Полная совместимость с Remnawave 2.1.4+ скрытыми зашифрованными подписками
- **Версионирование**: Информация о версии доступна в логах при старте и в healthcheck endpoint
- **Улучшенная Синхронизация**: Сохранение языка пользователя при обновлении данных из Remnawave
- **Обновленный API**: Использование новой структуры API с под-клиентами для лучшей организации кода
- **Реферальная система**: Поддержка default/progressive режима и расширенная статистика
- **История транзакций**: Удобный просмотр операций с пагинацией
- **Промокоды**: пользовательский сценарий активации и админ-раздел (при настроенном `ADMIN_TELEGRAM_ID`), миграция БД `000007_promo_codes`
- **Админ-статистика**: при `ADMIN_TELEGRAM_ID` в админ-панели — раздел со сводками по БД (пользователи, подписки, доходы в ₽, рефералы в днях, общая сводка)

## Web-кабинет (опционально, в разработке)

В проект добавляется web-кабинет — SPA + API, запускаемые в том же процессе, что и бот. Включается флагом `CABINET_ENABLED=true` в `.env`, по умолчанию **выключен** и никак не влияет на работу бота.

- **Как включить режим кабинета** (миграции, сборка SPA, env, Telegram, брендинг, smoke): [`documentation/cabinet-mode-setup.md`](documentation/cabinet-mode-setup.md). Переменные `CABINET_*` — в **`.env.sample`**. Технические материалы (ТЗ, план, nginx) при необходимости ведите у себя в `docs/cabinet/` (в шаблоне репозитория каталог `/docs/` в `.gitignore` и может не попадать в git).
- **Переход с версии без кабинета** (пошаговый upgrade, `.env`, Dockerfile/Compose, BotFather, smoke): [`documentation/cabinet-upgrade-guide.md`](documentation/cabinet-upgrade-guide.md).
- Детализация логики кабинета:
  - привязка/merge (`google`/`telegram`/`email`): `docs/cabinet/account-linking-and-merge.md`
  - платежи/checkout (preview/create/finalize, Stars, idempotency): `docs/cabinet/payments-and-checkout.md`
- Runtime-контент кабинета из `translations/cabinet/*.json`:
  - `GET /cabinet/api/content/faq` ← `translations/cabinet/FAQ.json`
  - `GET /cabinet/api/content/app-config` ← `translations/cabinet/app-config.json` (страница установки устройств `/cabinet/connections`)
  - при mount `./translations:/translations` изменения этих файлов применяются без ребилда образа.
- PWA (опционально): `CABINET_PWA_ENABLED=true` + (опционально) `CABINET_PWA_APP_NAME`, `CABINET_PWA_SHORT_NAME`.
  Manifest отдаётся runtime-эндпоинтом `GET /cabinet/api/public/pwa-manifest.webmanifest`.
- Поддомен и домен: `cabinet.example.com` → `proxy_pass http://127.0.0.1:<HEALTH_CHECK_PORT>` (пример nginx/TLS — в локальной копии `docs/cabinet/deploy-guide-simple.md`, если она у вас есть).
- Авторизация: email + пароль, Google OAuth2, Telegram Login 2.0 (OIDC для web) + Telegram Mini App `initData` (встроенный путь внутри Telegram).
- Синхронизация с ботом: аккаунт сайта и профиль Telegram связываются в одну запись `customer`; web-only пользователи получают synthetic `telegram_id` вне реального Telegram-диапазона и дополнительно помечаются колонкой `customer.is_web_only` — Telegram Bot API к ним никогда не вызывается.

Статус: выполнены этапы 0–10 (включая hardening: метрики Prometheus, CSP/HSTS по контексту, правка регистрации `/link/*` без платежей). Краткий обзор:

| Этап | Содержание |
|------|-----------|
| 0 | Скелет: `/cabinet/api/healthz`, SPA-заглушка, `go:embed` |
| 0.5 | Аудит `customer.telegram_id` |
| 1 | Миграция `000017_cabinet_schema`, synthetic telegram_id, startup-check |
| 2 | Auth-стек: Argon2id + JWT HS256 + refresh-ротация, CSRF, rate-limit, SMTP |
| 2.5 | `GET /me`, `PUT /me/language` |
| 3 | Bootstrap web-only customer, `cabinet_account_customer_link` |
| 4 | Публичная витрина `GET /tariffs` |
| 5 | Checkout + оплаты (YooKassa, CryptoPay), `Idempotency-Key` |
| 6 | `GET /me/subscription`: expire_at, link, tariff, loyalty_xp |
| 7 | Google OAuth (PKCE) + Telegram Login (MiniApp) |
| 8 | Link/Merge Telegram ↔ web customer: dry-run preview, атомарный merge, `cabinet_merge_audit` |
| **9a** | **Фронтенд: `web/cabinet/` — Vite 6 + React 19 + Tailwind 3, страницы auth, dark/light тема, RU/EN i18n, `dist/` в `go:embed`** |
| **9b** | **Dashboard (статус подписки + copy-link + loyalty), витрина тарифов (classic/tariffs mode), checkout (YooKassa/CryptoPay) + страница статуса оплаты с polling** |
| **9c** | **Настройки (пароль, язык, Google, Telegram link через OAuth 2.0), страница merge preview/confirm, автологин Mini App по `initData`, `PUT /me/password` на бэкенде** |
| **10** | **Метрики `GET /cabinet/api/metrics` (+ опциональный Basic-auth), CSP для SPA / security headers для API, маскирование IP/UA в логах, CI: `go build` + тесты кабинета + `scripts/cabinet-forbid-sensitive-slogs.sh`** |

### Дополнительный hardening (последние изменения)

- **Turnstile в auth (опционально):** при `CABINET_TURNSTILE_ENABLED=true` backend требует `X-Turnstile-Token` для `POST /cabinet/api/auth/register`, `POST /cabinet/api/auth/login`, `POST /cabinet/api/auth/password/forgot`.
- **SPA и Turnstile:** фронт читает `turnstile_enabled` + `turnstile_site_key` из `GET /cabinet/api/auth/bootstrap`, запрашивает токен только когда флаг включён и только для указанных auth-запросов. При `CABINET_TURNSTILE_ENABLED=false` UI работает как раньше.
- **IP rate-limit hardening:** `ClientIP` в cabinet доверяет `X-Forwarded-For`/`X-Real-IP` только от trusted proxy (loopback/private); вне прокси используется `RemoteAddr`.
- **Merge hardening:** для `/cabinet/api/link/merge/confirm` `Idempotency-Key` валидируется как `16..64` символов `[A-Za-z0-9._:-]`; внутренние merge-ошибки наружу не раскрываются.
- **DB update safety:** для динамических `UpdateFields` добавлен whitelist разрешённых полей и исправлено выполнение обновления через транзакцию (`tx.Exec`).

### Cabinet + Billing: последние функциональные изменения

- **Google/TG link conflict → merge:** в flow привязки занятый social identity переводит пользователя в merge preview (вместо тупиковой ошибки), с `provider` в query для корректного UI.
- **Merge provider-aware UI:** страница `/cabinet/link/merge` показывает корректный «найденный аккаунт» по `provider=google|telegram|email`; итоговый «Срок подписки» обновляется по выбранной стороне (`web`/`tg`) в реальном времени.
- **Telegram OIDC link fix:** сценарий «email-аккаунт привязывает Telegram, который уже связан с другим профилем» теперь формирует merge-claim и ведёт в merge-flow, а не в `telegram_oidc_failed`.
- **Checkout UX:** переход на страницу оплаты (YooKassa/CryptoPay/Stars) открывается в новой вкладке (fallback — текущая, если pop-up блокирован).
- **Web-only username в Remnawave:** новые web-only/synthetic пользователи создаются в панели с username формата `customerID_emailLocalPart` (fallback `customerID_web`), не `customerId_syntheticTelegramId`.
- **Самоудаление аккаунта кабинета:** `POST /cabinet/api/me/account/delete` удаляет пользователя в Remnawave (если найден), затем удаляет кабинетный аккаунт — чтобы не оставлять активную подписку в панели.

**Релиз / домен:** после смены домена кабинета обязательно обновите настройки в BotFather:
- `/setdomain` для Mini App / совместимости web-login.
- Telegram Login 2.0 (OIDC): trusted origin + redirect URI (например, `https://cabinet.example.com/cabinet/api/auth/telegram/callback`).
- Переменные кабинета: `CABINET_TELEGRAM_WEB_AUTH_MODE`, `CABINET_TELEGRAM_OIDC_CLIENT_ID`, `CABINET_TELEGRAM_OIDC_CLIENT_SECRET`, `CABINET_TELEGRAM_OIDC_REDIRECT_URL`, `CABINET_TELEGRAM_LOGIN_BOT_USERNAME`.
Метрики: переменные `CABINET_METRICS_*` в `.env.sample`.

### Telegram Auth 2.0 (micro guide)

1. В BotFather откройте раздел **Login Widget / OpenID Connect** для вашего бота.
2. Заполните в `.env`:
   - `CABINET_TELEGRAM_WEB_AUTH_MODE` = `oidc` (или `widget`, если нужен legacy Login Widget 1.0).
   - `CABINET_TELEGRAM_OIDC_CLIENT_ID` = `Client ID` из BotFather.
   - `CABINET_TELEGRAM_OIDC_CLIENT_SECRET` = `Client Secret` из BotFather.
   - `CABINET_TELEGRAM_OIDC_REDIRECT_URL` = `https://<ваш_домен>/cabinet/api/auth/telegram/callback`.
3. В BotFather добавьте:
   - **Redirect URI**: точно тот же URL, что в `CABINET_TELEGRAM_OIDC_REDIRECT_URL`.
   - **Trusted Origin**: `https://<ваш_домен>` (без path).
4. Для Mini App оставьте `/setdomain` на тот же хост кабинета.
5. Перезапустите сервис и проверьте web-вход «Войти через Telegram».

Режимы `CABINET_TELEGRAM_WEB_AUTH_MODE`:
- `oidc` — только Telegram OAuth 2.0 (web).
- `widget` — только legacy Telegram Login Widget 1.0 (web).

Важно:
- Совпадение `redirect_uri` должно быть **побайтно точным** (схема, хост, path, слеши).
- Ошибка `redirect_uri required` обычно означает, что Redirect URI не добавлен в BotFather или не совпадает с тем, что уходит в запросе.

Быстрый smoke (бот с `CABINET_ENABLED=true`): `curl -fsS http://127.0.0.1:$HEALTH_CHECK_PORT/cabinet/api/healthz` и при настроенных метриках — `curl -fsS -u user:pass .../cabinet/api/metrics | head`.

## Промокоды

### Для пользователей

- В главном меню доступен сценарий ввода промокода (код из букв и цифр).
- Поддерживаются типы: **дни подписки**, **триал**, **доп. слоты устройств**, **скидка в %** на следующую оплату (одно применение pending-скидки до успешной оплаты подписки или связанных покупок).
- Пока скидка по промокоду активна, в меню **«Мой VPN»** и в тексте экрана **покупки подписки** показывается напоминание о скидке.
- Оплата через **Tribute** не использует pending-скидку из промокода (остальные способы оплаты в боте — по логике `checkout`).

### Для администратора

- Задайте **`ADMIN_TELEGRAM_ID`** — у этого пользователя в главном меню появляется кнопка **«Админ»**.
- В админ-панели доступны: **рассылка**, **«Пользователи»** (списки, поиск, карточка, подписки/оплаты; при `tariffs` — операции с тарифом и панелью), **статистика** (сводки по пользователям, подпискам, доходам, рефералам и общий обзор), **синхронизация с Remnawave**, **«Промокоды»** (список с пагинацией, мастер создания, карточка: правки, статистика, вкл/выкл, «только первая покупка», удаление), при `SALES_MODE=tariffs` — **тарифы**; при **`LOYALTY_ENABLED=true`** — **«Лояльность»** (уровни, пересчёт XP из оплат).

### База данных и обновление

- Схема промокодов подключается миграцией **`000007_promo_codes`** (см. `db/migrations/`). При обновлении с версии без промокодов **выполните миграции** до запуска бота.

## Лояльность

Включение: **`LOYALTY_ENABLED=true`** (в `.env`, см. `.env.sample`). Пока выключено — интерфейс лояльности и начисление XP отключены, строки в БД не удаляются.

- **Таблицы:** `loyalty_tier` (пороги `xp_min`, процент скидки, опционально `display_name`), поле **`customer.loyalty_xp`** — миграции **`000014_loyalty`**, **`000015_loyalty_display_name`**.
- **Скидка при оплате:** суммируется с промо **аддитивно**, с потолком **`LOYALTY_MAX_TOTAL_DISCOUNT_PERCENT`** (общая логика в `internal/loyalty/pricing.go`, checkout — `internal/handler/promo_checkout.go`).
- **После успешной оплаты:** начисление XP — `XPRubEquivalentForPurchase` (`internal/loyalty/pricing.go`): сумма в ₽ или Stars×`RUB_PER_STAR` (в сумме уже учтены доп. устройства, если они в счёте), затем при нуле — минимум (`LOYALTY_XP_MIN_PER_PURCHASE`). Для Stars задайте **`RUB_PER_STAR`**, иначе вклад в XP из суммы будет нулевым и сработает только минимум (если включён).
- **Пользователь:** «Мой VPN» — кнопка и экран программы (`internal/handler/connect.go`, `loyalty_ui.go`); напоминания на экране покупки — как у промо, см. маркеры «Способы оплаты» в переводах.
- **Администратор:** при **`ADMIN_TELEGRAM_ID`** и включённой лояльности в админ-панели появляется кнопка — список уровней, редактирование (в т.ч. подпись для UI), экран **«Правила XP»** (текущие значения из env), добавление уровня, **пересчёт XP из всех успешных строк `purchase`** (полная перезапись `loyalty_xp`; идемпотентно при неизменной истории).
- Подробная спецификация: **`docs/loyalty/`**, кратко для ассистентов — **`AGENTS.md`**.

## Режим продаж: `classic` и `tariffs`

Переключатель задаётся переменной **`SALES_MODE`** в `.env` (значения: `classic` или `tariffs`). Оба режима используют одни и те же способы оплаты (YooKassa, CryptoPay, Stars, Tribute и т.д.), но по-разному формируют **цену и параметры подписки**.

### `SALES_MODE=classic` (по умолчанию)

- **Цены** берутся только из окружения: `PRICE_1`, `PRICE_3`, `PRICE_6`, `PRICE_12`; для Telegram Stars — `STARS_PRICE_*` (если `TELEGRAM_STARS_ENABLED=true`, иначе Stars не используются).
- Текст экрана покупки в основном из переводов (`pricing_info_trial` / `pricing_info_paid` / `pricing_info_paid_extra` в `translations/*.json`).
- **Лимиты при выдаче подписки в Remnawave** задаются конфигом: `TRAFFIC_LIMIT`, `TRAFFIC_LIMIT_RESET_STRATEGY`, `PAID_HWID_LIMIT`, `HWID_FALLBACK_DEVICE_LIMIT` и связанные переменные (см. таблицу env ниже). Таблицы `tariff` в логике покупки не используются.

### `SALES_MODE=tariffs`

- Нужны **миграции БД**: `000008_tariffs` (таблицы `tariff`, `tariff_price`, поля `customer.current_tariff_id`, `purchase.tariff_id` и др.) и **`000009_tariff_description`** (колонка `tariff.description` для текста на витрине).
- **Каталог и суммы**: активные тарифы и цены по периодам 1/3/6/12 месяцев хранятся в `tariff` / `tariff_price` (`amount_rub`, опционально `amount_stars`). Порядок списка — `sort_order`, активность — `is_active`.
- **Поведение «Купить»** (пошагово):
  1. Список тарифов: название, трафик, число устройств, минимальная цена в ₽ «от …», при необходимости описание; строка «текущий тариф» по `current_tariff_id` (если не задан — «неизвестно»).
  2. После выбора тарифа — карточка выбранного тарифа (параметры + описание) и кнопки периодов с ценами из БД.
  3. После выбора периода — краткий блок **«Способы оплаты»** и кнопки провайдеров.
  4. После выбора способа — снова карточка тарифа и кнопки **Оплатить** / **Назад** (создаётся счёт).
- **Кнопки периодов (1 / 3 / 6 / 12 мес.)** строятся только для строк `tariff_price`, где **`amount_rub` > 0**. Если для части периодов цена в рублях равна нулю, соответствующие кнопки **не показываются** — так можно оставить, например, только 1 и 3 месяца, задав цены вроде `150, 600, 0, 0` (и при необходимости ту же схему для Stars). Это не ошибка конфигурации, а осознанный способ «спрятать» длинные периоды.
- **Редактирование цен в админке**: после `|` можно указать **`auto`** для блока Stars — тогда звёзды считаются из рублёвых сумм по **`RUB_PER_STAR`** (как при мастере создания тарифа), например `1,2,3,4 | auto`.
не- **Апгрейд** (дешевле → дороже при активной подписке): полная цена нового периода; остаток старого тарифа пересчитывается в **дни нового** по дневным ценам пакетов. Итоговый срок задаётся **от момента оплаты** (`CreateOrUpdateUserWithTariffProfileFromNow`): к `expire_at` нельзя просто прибавлять «месяц + бонус», иначе календарный остаток учитывается дважды.
- **Даунгрейд** (дороже → дешевле при активной подписке): полная цена выбранного периода на дешёвом тарифе; остаток дорогого тарифа пересчитывается в дни дешёвого **той же формулой**, срок **от момента оплаты** (как у апгрейда). Предупреждение перед оплатой — `tariff_downgrade_early_warning`.
- **Админка**: при заданном `ADMIN_TELEGRAM_ID` в админ-панели есть раздел управления тарифами (создание, цены в ₽ и Stars, squads, описание). Если таблица тарифов **пуста**, при первом открытии списка тарифов в админке может быть **автоматически создан** тариф `standard` из текущих `PRICE_*`, `TRAFFIC_LIMIT`, лимитов устройств и squad/tag из env (удобно для миграции с `classic`).

#### Миграция пользователей с классической подпиской на учёт тарифа (вариант «наследник classic»)

Чтобы пользователи с активной подпиской из старого режима (`current_tariff_id` пустой) при переходе на премиум не получали лишние дни премиума по цене базового продления, им нужно **проставить текущий тариф**, эквивалентный прежнему classic (те же ₽ за 1/3/6/12 месяцев в `tariff_price`, те же лимиты/squads, что выдавала классика).

1. **Подготовка тарифа**: убедитесь, что в таблице `tariff` есть строка с **`slug = 'standard'`** и во всех нужных строках `tariff_price` заданы **`amount_rub`** за периоды 1, 3, 6, 12 — **в соответствии со старыми ценами** (как в `PRICE_*` при classic). Это может быть уже автосозданный тариф из админки или отдельная строка «Classic» — если используете другой slug, миграцию ниже выполните вручную с нужным slug.
2. **Опционально**: скройте наследника с витрины (`is_active = false`), если он только для расчётов и не должен продаваться отдельно.
3. **Миграция БД** `000011_backfill_customer_legacy_tariff`: при применении миграций она выставит `customer.current_tariff_id` на тариф со slug `standard` всем клиентам с **`expire_at > now()`** и **`current_tariff_id IS NULL`**. Если миграция прошла **до** появления строки `tariff` со slug `standard`, обновление затронет 0 строк — выполните тот же `UPDATE` вручную после создания тарифа (текст запроса — в файле миграции).
4. **Remnawave**: сама по себе миграция **не меняет** профили пользователей в панели — поменяется только учёт в боте до следующей оплаты или до явной синхронизации (если у вас есть сценарий массового применения профиля тарифа подписчикам).

### Какие переменные `.env` на что влияют в каждом режиме

| Переменные | `classic` | `tariffs` |
| ---------- | --------- | --------- |
| `PRICE_1` … `PRICE_12` | Основная цена подписки по периоду | **Обязательны при старте** (валидация конфига); используются для сида `standard` и как запасной ориентир; **фактическая цена покупки** — из `tariff_price.amount_rub` |
| `STARS_PRICE_*` | Цена в Stars по периоду (если Stars включены) | Для сида `standard` и при создании тарифа в админке; **оплата Stars** — из `amount_stars` в БД, либо расчёт через `RUB_PER_STAR` если Stars в строке цены не заданы |
| `RUB_PER_STAR` | Может не использоваться | Опционально: расчёт Stars при оплате Stars, если в `tariff_price` нет `amount_stars`; также подсказки при вводе цен в админке |
| `TRAFFIC_LIMIT`, `TRAFFIC_LIMIT_RESET_STRATEGY` | Лимит трафика при выдаче подписки | Лимит и стратегия **на уровне каждого тарифа** в БД; при сиде `standard` подставляются из этих env |
| `PAID_HWID_LIMIT`, `HWID_FALLBACK_DEVICE_LIMIT` | Лимит устройств при выдаче | Лимит **на уровне тарифа** в БД; сид `standard` берёт устройства из этих настроек |
| `HWID_ADD_PRICE`, `HWID_ADD_STARS_PRICE` | Доплата за доп. устройства | То же: доплата к счёту при выборе extra HWID |
| Промокоды (pending % скидка) | Вставка строки перед блоком способов оплаты в текстах `pricing_info_*` | Вставка перед строкой «Способы оплаты» на шаге выбора провайдера, если в тексте есть тот же HTML-маркер |
| `Tribute` | Без скидки по промокоду (как в коде) | Без изменений |

**Важно:** даже в режиме `tariffs` приложение при старте **требует** заданные `PRICE_1`…`PRICE_12` (и остальную обязательную конфигурацию) — это ограничение текущей инициализации `config`, а не «вторая ценовая сетка» для пользователя.

Тексты пошагового сценария в `tariffs` настраиваются в **`translations/ru.json`** и **`translations/en.json`** (ключи вида `buy_tariff_*`, `tariff_selected_*`, `tariff_payment_methods_text`, `payment_tariff_*`).

## Поддержка Версий

| Remnawave     | Бот    |
| ------------- | ------ |
| 1.6           | 2.3.6  |
| 2.0.0 - 2.1.9 | 3.3.\* |
| 2.2.\*        | 3.4.\* |
| 2.3.\*        | 3.5.\* |
| 2.7.\*        | 4.0.\* |

## API

Веб-сервер запускается на порту, определенном в .env через HEALTH_CHECK_PORT

- `/healthcheck` - Проверка здоровья сервиса. Возвращает JSON с информацией о статусе БД, Remnawave API, версии, коммите и дате сборки
- `/${TRIBUTE_PAYMENT_URL}` - Webhook для обработки платежей Tribute

## Переменные Окружения

Приложение требует установки следующих переменных окружения:

| Переменная                           | Описание                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SALES_MODE`                         | Режим продаж: `classic` (цены из env) или `tariffs` (каталог и цены из БД). Подробно — раздел **«Режим продаж: classic и tariffs»**                            |
| `PRICE_1`                            | Цена за 1 месяц                                                                                                                                               |
| `PRICE_3`                            | Цена за 3 месяца                                                                                                                                              |
| `PRICE_6`                            | Цена за 6 месяцев                                                                                                                                             |
| `PRICE_12`                           | Цена за 12 месяцев                                                                                                                                            |
| `SHOW_LONG_TERM_SAVINGS_PERCENT`     | Показывать на кнопках выбора периода (3 / 6 / 12 мес) экономию в процентах относительно покупки по месячной цене: формат «…₽ (-N%)». `classic`: база — `PRICE_1`; `tariffs` — цена 1 мес из `tariff_price` того же тарифа. Если многомесячная цена не ниже `N ×` месячной, суффикс не добавляется. По умолчанию `false` |
| `RUB_PER_STAR`                       | Сколько рублей условно «стоит» одна Telegram Star (`float`, пусто/`0` = не использовать). В `tariffs`: расчёт Stars при оплате, если в БД нет `amount_stars`; подсказки в админке; для **лояльности** — перевод суммы Stars в ₽ эквивалента при начислении XP и при пересчёте из истории |
| `LOYALTY_ENABLED`                    | Включить программу лояльности (скидки по уровням, XP, UI и админка). По умолчанию `false` |
| `LOYALTY_MAX_TOTAL_DISCOUNT_PERCENT`| Верхняя граница суммы процентов **лояльность + промо** после сложения (целое 1–100, по умолчанию 100) |
| `LOYALTY_XP_MIN_PER_PURCHASE`       | Минимум XP за успешную оплату, если сумма в ₽/Stars не дала баллов (0 = выкл.) |
| `DAYS_IN_MONTH`                      | Дней в месяце                                                                                                                                                 |
| `DEFAULT_LANGUAGE`                   | Язык по умолчанию для сообщений бота (en или ru). По умолчанию: ru                                                                                            |
| `REMNAWAVE_TAG`                      | Тег в remnawave                                                                                                                                               |
| `TRIAL_REMNAWAVE_TAG`                | Тег для назначения пробным пользователям в Remnawave (опционально, если не установлен, используется обычный REMNAWAVE_TAG)                                    |
| `HEALTH_CHECK_PORT`                  | Порт сервера                                                                                                                                                  |
| `IS_WEB_APP_LINK`                    | Если true, то ссылка подписки будет показана как webapp..                                                                                                     |
| `REMNAWAVE_HEADERS`                  | Дополнительные заголовки для запросов к remnawave (формат: key1:value1;key2:value2). Пример: X-Api-Key:your_key;X-Custom:value (опционально)                  |
| `MINI_APP_URL`                       | URL tg WEB APP. если пустой, не используется.                                                                                                                 |
| `PRICE_12`                           | Цена за 12 месяцев                                                                                                                                            |
| `STARS_PRICE_1`                      | Цена в Stars за 1 месяц                                                                                                                                       |
| `STARS_PRICE_3`                      | Цена в Stars за 3 месяца                                                                                                                                      |
| `STARS_PRICE_6`                      | Цена в Stars за 6 месяцев                                                                                                                                     |
| `STARS_PRICE_12`                     | Цена в Stars за 12 месяцев                                                                                                                                    |
| `REFERRAL_MODE`                      | Режим реферальной системы: `default` или `progressive`                                                                                                         |
| `REFERRAL_DAYS`                      | Дни реферального бонуса в режиме `default`. если 0, то отключено.                                                                                              |
| `REFERRAL_FIRST_REFERRER_DAYS`       | Дни, которые получает пригласивший при первом пополнении реферала                                                                                             |
| `REFERRAL_FIRST_REFEREE_DAYS`        | Дни, которые получает новый пользователь при первом пополнении                                                                                                 |
| `REFERRAL_REPEAT_REFERRER_DAYS`      | Дни, которые получает пригласивший за каждое последующее пополнение реферала                                                                                   |
| `TRIAL_ADD_TO_PAID`                  | Учитывать дни триала при покупке платной подписки (true/false)                                                                                                 |
| `TELEGRAM_TOKEN`                     | Telegram Bot API токен для функциональности бота                                                                                                              |
| `TELEGRAM_PROXY_URL`                 | Прокси для Telegram Bot API (http/https). Пример: http://user:pass@ip:3128. Если пусто — запросы идут напрямую                                               |
| `DATABASE_URL`                       | Строка подключения PostgreSQL                                                                                                                                 |
| `POSTGRES_USER`                      | Имя пользователя PostgreSQL                                                                                                                                   |
| `POSTGRES_PASSWORD`                  | Пароль PostgreSQL                                                                                                                                             |
| `POSTGRES_DB`                        | Имя базы данных PostgreSQL                                                                                                                                    |
| `REMNAWAVE_URL`                      | URL API Remnawave                                                                                                                                             |
| `REMNAWAVE_MODE`                     | Режим Remnawave (remote/local), по умолчанию remote. Если local установлен – можно передать http://remnawave:3000 в REMNAWAVE_URL                             |
| `REMNAWAVE_TOKEN`                    | Токен аутентификации для Remnawave API                                                                                                                        |
| `CRYPTO_PAY_ENABLED`                 | Включить/отключить способ оплаты CryptoPay (true/false)                                                                                                       |
| `CRYPTO_PAY_TOKEN`                   | Токен API CryptoPay                                                                                                                                           |
| `CRYPTO_PAY_URL`                     | URL API CryptoPay                                                                                                                                             |
| `YOOKASA_ENABLED`                    | Включить/отключить способ оплаты YooKassa (true/false)                                                                                                        |
| `YOOKASA_SECRET_KEY`                 | Секретный ключ API YooKassa                                                                                                                                   |
| `YOOKASA_SHOP_ID`                    | Идентификатор магазина YooKassa                                                                                                                               |
| `YOOKASA_URL`                        | URL API YooKassa                                                                                                                                              |
| `YOOKASA_EMAIL`                      | Email адрес, связанный с аккаунтом YooKassa                                                                                                                   |
| `MOYNALOG_ENABLED`                   | Включить/отключить интеграцию с Мой Налог (true/false)                                                                                                         |
| `MOYNALOG_URL`                       | URL API Мой Налог (по умолчанию https://lknpd.nalog.ru/api/v1)                                                                                                 |
| `MOYNALOG_USERNAME`                  | Логин для Мой Налог                                                                                                                                           |
| `MOYNALOG_PASSWORD`                  | Пароль для Мой Налог                                                                                                                                          |
| `MOYNALOG_PROXY_URL`                 | Прокси для запросов к Мой Налог (http/https/socks5). Пример: http://user:pass@ip:3128 или socks5://user:pass@ip:1080. Если пусто — запросы идут напрямую     |
| `TRAFFIC_LIMIT`                      | Максимально разрешенный трафик в гб (0 для неограниченного)                                                                                                   |
| `TELEGRAM_STARS_ENABLED`             | Включить/отключить способ оплаты Telegram Stars (true/false)                                                                                                  |
| `REQUIRE_PAID_PURCHASE_FOR_STARS`    | Требовать успешную оплату через криптовалюту или карту перед использованием Telegram Stars (true/false). По умолчанию: false                                  |
| `SERVER_STATUS_URL`                  | URL страницы статуса сервера (опционально) - если не установлен, кнопка не отображается                                                                       |
| `SUPPORT_URL`                        | URL чата поддержки или страницы (опционально) - если не установлен, кнопка не отображается                                                                    |
| `FEEDBACK_URL`                       | URL страницы отзывов/обратной связи (опционально) - если не установлен, кнопка не отображается                                                                |
| `CHANNEL_URL`                        | URL Telegram канала (опционально) - если не установлен, кнопка не отображается                                                                                |
| `TOS_URL`                            | URL условий использования (опционально) - если не установлен, кнопка не отображается                                                                          |
| `VIDEO_GUIDE_URL`                    | URL видеоинструкции (опционально) - если установлен, кнопка "📺 Видеоинструкция" отображается в разделе "Помощь"                                              |
| `SERVER_SELECTION_URL`               | URL страницы с информацией о выборе сервера (опционально) - если установлен, кнопка "🌏 Какой сервер выбрать" отображается в разделе "Помощь"                 |
| `PUBLIC_OFFER_URL`                   | URL публичной оферты (опционально) - если установлен, кнопка "📄 Публичная оферта" отображается в разделе "Помощь"                                            |
| `PRIVACY_POLICY_URL`                 | URL политики конфиденциальности (опционально) - если установлен, кнопка "🔒 Политика конфиденциальности" отображается в разделе "Помощь"                      |
| `TERMS_OF_SERVICE_URL`               | URL пользовательского соглашения (опционально) - если установлен, кнопка "📋 Пользовательское соглашение" отображается в разделе "Помощь"                     |
| `ADMIN_TELEGRAM_ID`                  | ID telegram админа; кнопка «Админ»: рассылка, **пользователи**, статистика, синхронизация, промокоды; при `SALES_MODE=tariffs` — тарифы; при лояльности — раздел лояльности. Промокоды — миграция `000007_promo_codes` |
| `CABINET_TURNSTILE_ENABLED`          | Включить Cloudflare Turnstile в web-кабинете для `register/login/forgot` (`true/false`, по умолчанию `false`) |
| `CABINET_TURNSTILE_SITE_KEY`         | Публичный ключ Turnstile (обязателен при `CABINET_TURNSTILE_ENABLED=true`) |
| `CABINET_TURNSTILE_SECRET_KEY`       | Секретный ключ Turnstile для backend-валидации (обязателен при `CABINET_TURNSTILE_ENABLED=true`) |
| `BLOCKED_TELEGRAM_IDS`               | Список Telegram ID, разделенных запятыми, для блокировки доступа к боту (например, "123456789,987654321")                                                     |
| `WHITELISTED_TELEGRAM_IDS`           | Список Telegram ID, разделенных запятыми, которые обходят все проверки на подозрительных пользователей (например, "111111111,222222222,333333333")            |
| `TRIAL_TRAFFIC_LIMIT`                | Максимально разрешенный трафик в гб для пробных подписок                                                                                                      |
| `TRIAL_DAYS`                         | Количество дней для пробных подписок. если 0 = отключено.                                                                                                     |
| `TRIAL_INTERNAL_SQUADS`              | Список UUID squad, разделенных запятыми, для назначения пробным пользователям (опционально, если не установлено, используются SQUAD_UUIDS)                    |
| `TRIAL_EXTERNAL_SQUAD_UUID`          | Один внешний UUID squad для назначения пробным пользователям (опционально, если не установлено, используется EXTERNAL_SQUAD_UUID)                             |
| `SQUAD_UUIDS`                        | Список UUID squad, разделенных запятыми, для назначения пользователям (например, "773db654-a8b2-413a-a50b-75c3536238fd,bc979bdd-f1fa-4d94-8a51-38a0f518a2a2") |
| `EXTERNAL_SQUAD_UUID`                | Один внешний UUID squad для назначения пользователям при создании и обновлении (опционально, например, "773db654-a8b2-413a-a50b-75c3536238fd")                |
| `TRAFFIC_LIMIT_RESET_STRATEGY`       | Стратегия сброса трафика для обычных подписок (day/week/month/never). По умолчанию: month                                                                     |
| `TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY` | Стратегия сброса трафика для пробных подписок (day/week/month/never). По умолчанию: month                                                                     |
| `TRIBUTE_WEBHOOK_URL`                | Путь для обработчика webhook. Пример: /example (https://www.uuidgenerator.net/version4)                                                                       |
| `TRIBUTE_API_KEY`                    | API ключ, который можно получить через настройки в приложении Tribute.                                                                                        |
| `TRIBUTE_PAYMENT_URL`                | Ваш URL оплаты для Tribute. (Ссылка подписки telegram)                                                                                                        |
| `HWID_EXTRA_DEVICES_ENABLED`         | `true` / `false` — включить продажу доп. HWID (кнопки, счета с `extra`, отдельная оплата устройств). `false` не отменяет уже выданные слоты до истечения; подписку без допа можно продлить. По умолчанию `true` (если не задано) |
| `HWID_ADD_PRICE`                     | Цена за 1 доп. устройство в рублях                                                                                                                            |
| `HWID_ADD_STARS_PRICE`               | Цена за 1 доп. устройство в Telegram Stars                                                                                                                     |
| `HWID_MAX_DEVICE`                    | Максимальный лимит устройств в одной подписке                                                                                                                 |
| `TRIAL_HWID_LIMIT`                   | Лимит устройств для пробной подписки                                                                                                                           |
| `PAID_HWID_LIMIT`                    | Лимит устройств для платной подписки (0 = использовать HWID_FALLBACK_DEVICE_LIMIT)                                                                            |
| `HWID_FALLBACK_DEVICE_LIMIT`         | Лимит устройств по умолчанию, когда лимит устройств пользователя не установлен в Remnawave (по умолчанию: 2)                                                  |

## Пользовательский Интерфейс

Бот динамически создает кнопки на основе доступных переменных окружения:

- Основные кнопки для покупки и подключения к VPN всегда отображаются
- Дополнительные кнопки для Статуса Сервера, Поддержки, Отзывов и Канала отображаются только если установлены соответствующие URL переменные окружения
- В разделе "Помощь" кнопки строятся в порядке: ряд «🌏 Какой сервер выбрать» / «📺 Видеоинструкция» (если заданы `SERVER_SELECTION_URL` и/или `VIDEO_GUIDE_URL`), отдельный ряд «🆘 Поддержка» (`SUPPORT_URL`), ряд «📄 Публичная оферта» / «🔒 Политика конфиденциальности» (`PUBLIC_OFFER_URL`, `PRIVACY_POLICY_URL`), отдельный ряд «📋 Пользовательское соглашение» (`TERMS_OF_SERVICE_URL`); кнопки с пустыми URL не показываются

## Автоматизированные Уведомления

Бот включает систему уведомлений, которая запускается ежедневно в 16:00 UTC для проверки истекающих подписок:

- Пользователи получают уведомление за 3 дня до истечения их подписки
- Уведомление включает точную дату истечения и удобную кнопку для продления подписки
- Уведомления отправляются на предпочитаемом языке пользователя

### Внутренние Squads (SQUAD_UUIDS)

- Настройте конкретные UUID squad в переменной окружения `SQUAD_UUIDS` (разделенные запятыми)
- Если указано, только squads с соответствующими UUID будут назначены новым пользователям
- Если ни один squad не соответствует указанным UUID или переменная пуста, будут назначены все доступные squads
- Эта функция позволяет точно контролировать, какие методы подключения доступны пользователям

### Внешний Squad (EXTERNAL_SQUAD_UUID)

- Настройте один внешний UUID squad в переменной окружения `EXTERNAL_SQUAD_UUID`
- Когда установлено, этот внешний squad будет включен во все запросы на создание и обновление пользователей в Remnawave API
- UUID проверяется и парсится при запуске приложения; неверный формат предотвратит запуск приложения
- Оставьте пустым, чтобы отключить назначение внешнего squad

### Конфигурация Squad для Пробных Пользователей (TRIAL_INTERNAL_SQUADS и TRIAL_EXTERNAL_SQUAD_UUID)

Пробные пользователи могут быть назначены в отдельные squad, отличные от обычных платных пользователей:

#### Внутренние Squad для Пробных Пользователей (TRIAL_INTERNAL_SQUADS)

- Настройте конкретные UUID squad для пробных пользователей в переменной окружения `TRIAL_INTERNAL_SQUADS` (разделенные запятыми)
- Если указано, только эти squad будут назначены пользователям при активации пробных подписок
- Если пусто или не установлено, пробные пользователи будут назначены в обычные squad, определенные в `SQUAD_UUIDS` (поведение fallback)
- Пример: `TRIAL_INTERNAL_SQUADS=773db654-a8b2-413a-a50b-75c3536238fd,bc979bdd-f1fa-4d94-8a51-38a0f518a2a2`

#### Внешний Squad для Пробных Пользователей (TRIAL_EXTERNAL_SQUAD_UUID)

- Настройте один внешний UUID squad для пробных пользователей в переменной окружения `TRIAL_EXTERNAL_SQUAD_UUID`
- Если указано, этот внешний squad будет включен во все запросы на создание и обновление пробных пользователей
- Если пусто или не установлено, пробные пользователи будут использовать обычный squad, определенный в `EXTERNAL_SQUAD_UUID` (поведение fallback)
- Пример: `TRIAL_EXTERNAL_SQUAD_UUID=773db654-a8b2-413a-a50b-75c3536238fd`

**Применение:** Изоляция пробных пользователей в отдельных squad для мониторинга, распределения ресурсов или тестирования конкретных функций

## Плагины и Зависимости

### Telegram Bot

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Go Telegram Bot API](https://github.com/go-telegram/bot)

### База Данных

- [PostgreSQL](https://www.postgresql.org/)
- [pgx - PostgreSQL Driver](https://github.com/jackc/pgx)

## Инструкции по Установке

1. Клонируйте репозиторий

```bash
git clone
```

2. Создайте файл `.env` в корневой директории со всеми переменными окружения, перечисленными выше

```bash
mv .env.sample .env
```

3. Запустите бота:

```bash
docker compose up -d
```

## Инструкции по Настройке Платежей Tribute

> [!WARNING]
> Для интеграции с Tribute у вас должен быть публичный домен (например, `bot.example.com`), который указывает на ваш сервер бота.  
> Настройка webhook и подписки не будет работать на локальном адресе или IP — только через домен с действительным SSL
> сертификатом.

### Как работает интеграция

Бот поддерживает управление подписками через сервис Tribute. Когда пользователь нажимает кнопку оплаты, он перенаправляется
в бота Tribute или на страницу оплаты для завершения подписки. После успешной оплаты Tribute отправляет webhook
на ваш сервер, и бот активирует подписку для пользователя.

### Пошаговое руководство по настройке

1. Начало работы

- Создайте канал;
- В приложении Tribute откройте "Channels and Groups" и добавьте ваш канал;
- Создайте новую подписку;
- Получите ссылку на подписку (Subscription -> Links -> Telegram Link).

2. Настройте переменные окружения в `.env`

   - Установите путь webhook (например, `/tribute/webhook`):

   ```
   TRIBUTE_WEBHOOK_URL=/tribute/webhook
   ```

   - Установите API ключ из ваших настроек Tribute:

   ```
   TRIBUTE_API_KEY=your_tribute_api_key
   ```

   - Вставьте ссылку на подписку, которую вы получили от Tribute:

   ```
   TRIBUTE_PAYMENT_URL=https://t.me/tribute/app?startapp=...
   ```

   - Укажите порт, который будет использовать приложение:

   ```
   HEALTH_CHECK_PORT=82251
   ```

3. Перезапустите бота

```bash
docker compose down && docker compose up -d
```

## Мой Налог через прокси (для серверов вне РФ)

Если ваш сервер находится за пределами РФ и доступ к `lknpd.nalog.ru` блокируется, можно направить **только запросы Мой Налог** через прокси (HTTP или SOCKS5, например squid или gost на ВДС в РФ).

### Мини‑гайд

1. Убедитесь, что прокси доступен из контейнера (IP/порт, логин/пароль).
2. В `.env` включите Мой Налог и укажите прокси:

```
MOYNALOG_ENABLED=true
MOYNALOG_URL=https://lknpd.nalog.ru/api/v1
MOYNALOG_PROXY_URL=http://user:pass@ip:3128
```

Для SOCKS5 используйте:

```
MOYNALOG_PROXY_URL=socks5://user:pass@ip:1080
```

3. Перезапустите бота:

```bash
docker compose down && docker compose up -d
```

Если `MOYNALOG_PROXY_URL` пустой — бот работает как раньше, без прокси.

## Настройка кнопок (цвет и emoji)

Кнопки можно задавать строкой (как раньше) или объектом в `translations/*.json`.
Если `style` не указан — цвет не применяется. Если стиль указан с ошибкой — он игнорируется.

### Пример объекта кнопки

```json
{
  "buy_button": {
    "text": "💰 Купить",
    "style": "blue",
    "emoji_id": "1234567890123456789"
  }
}
```

### Доступные значения `style`

- `blue` (алиас `primary`)
- `green` (алиас `success`, также поддерживается опечатка `sucess`)
- `red` (алиас `danger`)

### Про `emoji_id`

`emoji_id` — это идентификатор кастомного emoji Telegram (не обычный Unicode).
Его можно получить из объектов Telegram API при выборе/использовании кастомного emoji.

## Как Изменить Сообщения Бота

Перейдите в папку translations внутри папки бота и измените нужный язык.

## Инструкции по Обновлению

1. Получите последний Docker образ:

```bash
docker compose pull
```

2. Перезапустите контейнеры:

```bash
docker compose down && docker compose up -d
```

## Конфигурация Обратного Прокси

Если вы не используете ngrok из `docker-compose.yml`, вам нужно настроить обратный прокси для пересылки запросов к боту.

<details>
<summary>Конфигурация Traefik</summary>

```yaml
http:
  routers:
    remnawave-telegram-shop:
      rule: "Host(`bot.example.com`)"
      entrypoints:
        - http
      middlewares:
        - redirect-to-https
      service: remnawave-telegram-shop

    remnawave-telegram-shop-secure:
      rule: "Host(`bot.example.com`)"
      entrypoints:
        - https
      tls:
        certResolver: letsencrypt
      service: remnawave-telegram-shop

  middlewares:
    redirect-to-https:
      redirectScheme:
        scheme: https

  services:
    remnawave-telegram-shop:
      loadBalancer:
        servers:
          - url: "http://bot:82251"
```

</details>

## Пожертвования

Если вы цените этот проект и хотите помочь поддерживать его работу (и подпитывать эти марафоны кодирования на кофеине),
рассмотрите возможность пожертвования. Ваша поддержка помогает стимулировать будущие обновления и улучшения.

**Способы Пожертвования:**

- **Bep20 USDT:** `0x4D1ee2445fdC88fA49B9d02FB8ee3633f45Bef48`

- **SOL Solana:** `HNQhe6SCoU5UDZicFKMbYjQNv9Muh39WaEWbZayQ9Nn8`

- **TRC20 USDT:** `TBJrguLia8tvydsQ2CotUDTYtCiLDA4nPW`

- **TON USDT:** `UQAdAhVxOr9LS07DDQh0vNzX2575Eu0eOByjImY1yheatXgr`
