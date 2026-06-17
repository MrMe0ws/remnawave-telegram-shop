# Changelog

## [Unreleased]

## [4.11.3] - 2026-06-17

### Added

- **Marketing-режим витрины тарифов** (`CABINET_TARIFF_PRICE_DISPLAY`): `monthly` | `marketing` — эффективная ₽/мес при оплате за 12 месяцев на карточках планов + сноска «*При оплате за год».
- Админка: **Настройки бота → Тарифы** (группа `tariffs`, hot-reload).
- API: `price_display` в `GET /cabinet/api/tariffs`.
- **Подробное описание тарифа** (`tariff.description_detail`, миграция **`000039`**): краткий `description` — витрина и бот; подробный текст — шаг `/cabinet/tariffs?plan=<slug>`. Редактор в web-админке → Тарифы. Toast при сохранении тарифа.

### Changed

- **Web-админка → Настройки бота** (`/admin/settings`): вместо сетки из 13 секций — **5 категорий-вкладок** (Оформление, Продукт, Маркетинг, Операции, Доступ); в категории показываются только её группы-аккордеоны; поиск по всем группам с бейджем категории. Документация для ассистентов: `.cursor/docs/frontend/admin-settings-ui.md`.
- Страница тарифов: цена на карточках — `2.5rem`; синяя сумма на шаге выбора периода — целые рубли без копеек.
- **`TariffDescription`**: `whitespace-pre-wrap` и `remark-breaks` — сохранение ручных пробелов, табов и переносов строк в кратком и подробном описании (превью админки и страница плана).

### Technical

- `internal/cabinet/config/tariffs_display.go`, `web/cabinet/src/features/tariffs/tariffShowcasePrice.ts`.
- Док: `.cursor/docs/frontend/cabinet-tariff-showcase.md`.
- `description_detail`: `tariff.go`, `catalog.go`, `admin_tariffs.go`, `TariffsPage.tsx`, `AdminTariffEditor.tsx`, `TariffDescription.tsx`. Док: `.cursor/docs/frontend/cabinet-tariff-descriptions.md`.
- Зависимость `remark-breaks` в `web/cabinet`.

## [4.11.2] - 2026-06-16

### Added

- **Декор-темы кабинета** (`CABINET_DECOR_THEME`): color-only (`green`, `pink`, `orange`, `yellow`) и сезонные пресеты (`neon`, `new_year`, `summer`, `halloween`, `valentine`, `spring`, `black_friday`).
- Переключение в web-админке: **Настройки → Оформление кабинета** (группа `cabinet`, hot-reload без рестарта).
- Bootstrap: поле `decor_theme` в `GET /cabinet/api/auth/bootstrap`.

### Changed

- Акценты UI кабинета подстраиваются под выбранную декор-тему вместо фиксированного cyan.
- **Профиль:** иконка на кнопке «Привязанные аккаунты».

### Fixed

- CTA «Подключить устройство»: артеfact conic-gradient в decor-темах.
- Spring / Black Friday: старт анимации частиц без задержки при открытии страницы.

### Technical

- `internal/cabinet/config/decor.go`, whitelist в `settings_registry.go`, модуль `web/cabinet/src/features/decor/`.

## [4.11.0] - 2026-06-15

### Added

- **Web-админка кабинета** (`/cabinet/admin/*`, `CABINET_ENABLED=true`, `ADMIN_TELEGRAM_ID`): статистика (в т.ч. колесо фортуны), пользователи и панель Remnawave, промокоды, тарифы, лояльность, **рассылка** (audiences, preview, send через Telegram), infra billing, sync.
- **Admin API** `/cabinet/api/admin/*`: `RequireAuth` + `RequireAdmin`, CSRF на мутациях, rate-limit 120 req/min/аккаунт; feature flags — `GET /admin/bootstrap`.
- **Admin SPA**: `AdminChrome` (отдельный header без user nav), sidebar, breadcrumbs, typed `types/admin.ts`, i18n `admin.*` (ru/en).

### Changed

- **Тёмная тема кабинета**: разведение поверхностей (background → card → header), многослойный фон, elevated cards (`.cabinet-elevated-card`), улучшенный sticky header с blur и cyan-accent border.
- **User cabinet pages**: единые elevated-card поверхности на dashboard, subscription, tariffs, loyalty, profile.

### Technical

- Handlers `internal/cabinet/http/handlers/admin_*.go`, middleware `admin.go`, auth `internal/cabinet/admin/auth/`.
- **Shared broadcast layer** — `internal/broadcast/` (Sender, markup, links); TG-админка и web-админка используют одну логику доставки.
- HTTP-тесты admin middleware и handlers; deep merge i18n для admin keys.

## [4.4.0] - 2026-04-20

### Added

- **Лояльность**: программа XP и уровней скидки (`LOYALTY_ENABLED`), миграции `000014_loyalty`, `000015_loyalty_display_name`, экран пользователя и админка уровней, пересчёт XP из истории покупок.
- **Экран «Мой VPN»**: при достижении месячного лимита трафика показывается пометка (`vpn_traffic_limit_reached`).

### Fixed

- **Продление подписки**: после успешной оплаты подписки вызывается сброс накопленного трафика в панели (`POST .../actions/reset-traffic`), чтобы счётчик не переносился на новый период.

### Technical

- Игнорирование JVM-дампов `hs_err_pid*.log`, `replay_pid*.log`; удалены случайно закоммиченные логи.

## [3.5.0] - 2025-01-XX

### Changed

- **Remnawave API**: Обновлен SDK с `remnawave-api-go v2.2.3` до `v2.3.2`
- **Совместимость**: Версия 3.5.0 совместима с Remnawave начиная от версии 2.3.0+
- **Типы API**: Обновлены типы ответов API:
  - `UserResponseResponse` → `User`
  - `UsersResponseResponseItem` → `User`
  - `GetAllUsersResponseDtoResponseUsersItem` → `User`
  - `GetInternalSquadsResponseDto` → `InternalSquadsResponse`
  - `HwidDevicesResponseResponseDevicesItem` → `Device`
- **Сигнатуры методов API**: Обновлены вызовы методов:
  - `GetAllUsers` теперь принимает `(ctx, float64, float64)` вместо структуры параметров
  - `GetUserByTelegramId` теперь принимает `(ctx, string)` вместо структуры параметров
  - `GetUserHwidDevices` теперь принимает `(ctx, string)` вместо структуры параметров
- **Обработка ошибок**: Убрана обработка `NotFoundError` (больше не возвращается в новой версии API)
- **Обновлены зависимости**:
  - `golang.org/x/text`: `v0.30.0` → `v0.31.0`
  - `github.com/go-faster/jx`: `v1.1.0` → `v1.2.0`
  - `github.com/ogen-go/ogen`: `v1.16.0` → `v1.18.0`
  - `go.uber.org/zap`: `v1.27.0` → `v1.27.1`
  - `golang.org/x/crypto`: `v0.43.0` → `v0.44.0`
  - `golang.org/x/net`: `v0.46.0` → `v0.47.0`
  - `golang.org/x/sync`: `v0.17.0` → `v0.18.0`
  - `golang.org/x/sys`: `v0.37.0` → `v0.38.0`

### Fixed

- **Tribute webhook**: Исправлена паника при обработке успешного платежа для несуществующего клиента
  - Добавлена проверка ошибки после `FindByTelegramId`
  - Добавлена проверка на `nil` для `customer` перед вызовом `CreatePurchase`
- **Поиск пользователей**: Добавлена проверка на пустой ответ при поиске пользователя по Telegram ID в Remnawave API
  - Если API возвращает пустой массив пользователей, создается новый пользователь
- **Доступ к трафику**: Исправлен доступ к использованному трафику через `UserTraffic.UsedTrafficBytes` вместо прямого поля

### Technical

- Обновлены все функции работы с пользователями для использования новых типов API
- Рефакторинг обработки ответов API: переход с `switch` на проверку типа с `type assertion`
- Улучшена обработка пустых ответов во всех методах поиска пользователей
- Обновлены методы `GetUserInfo`, `GetUserTrafficInfo`, `GetUserDevicesByUuid` для новой версии API

### Migration Notes

- ⚠️ **Важно**: При обновлении до версии 3.5.0 убедитесь, что ваш Remnawave сервер обновлен до версии 2.3.0 или выше
- Версия 3.5.0 не совместима с Remnawave версий ниже 2.3.0
- Все уникальные функции бота (стратегии сброса трафика, trial пользователи) сохранены и работают корректно

## [3.4.0] - 2025-11-24

### Added

- **Управление версиями через ldflags**: Добавлены переменные `Version`, `Commit`, `BuildDate` для отслеживания версий приложения
- **Метаданные версии в healthcheck**: Информация о версии доступна в ответе endpoint `/healthcheck`
- **EXTERNAL_SQUAD_UUID**: Параметр конфигурации для назначения внешнего отряда при создании и обновлении пользователей
- **Конфигурация Trial Squads**: Добавлены переменные `TRIAL_INTERNAL_SQUADS` и `TRIAL_EXTERNAL_SQUAD_UUID` для изоляции пробных пользователей в отдельных отрядах
- **Trial Remnawave Tag**: Добавлена переменная `TRIAL_REMNAWAVE_TAG` для назначения отдельного тега пробным пользователям
- **Унифицированные заголовки Remnawave**: Заменен `X_API_KEY` на `REMNAWAVE_HEADERS` с поддержкой множественных заголовков (формат: `key1:value1;key2:value2`)
- **Стратегия сброса трафика**: Добавлены переменные `TRAFFIC_LIMIT_RESET_STRATEGY` и `TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY` для настройки сброса трафика (day/week/month/never)
- **Telegram Stars Payment Gatekeeping**: Добавлена переменная `REQUIRE_PAID_PURCHASE_FOR_STARS` для ограничения доступа к оплате через Telegram Stars только для пользователей с успешными платежами
- **TestHook для Tribute webhook**: Добавлена константа и обработчик для тестирования webhook endpoint без активации реальных событий

### Changed

- **Терминология**: Изменена с "входящего" на "отряд" в настройках и интеграции API
- **Версия Go**: Обновлена с 1.24 до 1.25.3
- **Remnawave API**: Миграция на `remnawave-api-go v2.2.3` с улучшенной поддержкой пагинации
- **Поддержка версий Remnawave**: С версии 3.4.0 бот поддерживает только Remnawave 2.2.\*
- При оплате платной подписки пользователи автоматически переводятся из trial squads в обычные squads
- Обновление пользователей теперь включает изменение внутренних и внешних squads в зависимости от типа подписки
- Все методы создания и обновления пользователей используют соответствующие стратегии сброса трафика (trial или платная)
- Система сборки улучшена за счет явного захвата хеша коммита git в сборках Docker
- Переменные среды `.env.sample` обновлены с добавлением новых параметров конфигурации и документации

### Fixed

- Исправлена ошибка валидации тегов: теги проверяются на соответствие формату `^[A-Z0-9_]+$` перед установкой
- Исправлено отсутствие обновления squads при переходе пользователя с trial на платную подписку
- Сохранение поля языка пользователя во время обновления патча синхронизации
- Улучшена фильтрация проверки имени пользователя для уменьшения ложных срабатываний при сохранении безопасности

### Documentation

- Добавлена подробная документация по `EXTERNAL_SQUAD_UUID` параметрам конфигурации в README
- Обновлен файл README с новыми скриптами сборки и информацией об управлении версиями
- Добавлено описание изменений терминологии в отрядах
- Обновлена таблица совместимости версий Remnawave и бота

### Technical

- Добавлены методы `TrialInternalSquads()`, `TrialExternalSquadUUID()`, `TrialRemnawaveTag()` в `internal/config/cofig.go`
- Добавлен метод `TrafficLimitResetStrategy()` для обычных пользователей
- Обновлены методы `updateUserWithStrategy()` и `createUserWithStrategy()` для поддержки trial конфигурации
- Добавлена функция `isValidTag()` для валидации тегов Remnawave
- Рефакторинг `headerTransport` для поддержки множественных заголовков через `REMNAWAVE_HEADERS`
- Поддержка помощника пагинации через `remnawave-api-go v2.2.3`
- Разработка скрипта сборки Docker (`build-dev.sh`) для упрощения создания локального образа

### Removed

- `X_API_KEY` переменная окружения (заменена на `REMNAWAVE_HEADERS`)

## [3.3.0] - 2025-11-21

### Added

- **Рассылка сообщений для юзеров**: Админ пишет сообщение, отправляет его боту - бот рассылает всем клиентам. 29 сообщений в 1 секунду в порядке очереди. Ограничение телеграм апи - 30 сообщений в 1 сек.
- **Черный список пользователей**: Добавлена переменная окружения `BLOCKED_TELEGRAM_IDS` для блокировки доступа к боту по Telegram ID
- **Белый список пользователей**: Добавлена переменная окружения `WHITELISTED_TELEGRAM_IDS` для обхода проверок на подозрительных пользователей
- **Улучшенная фильтрация подозрительных пользователей**: Теперь проверяются комбинации опасных ключевых слов вместо отдельных слов

### Changed

- Улучшена детекция подозрительных пользователей: проверка комбинаций опасных ключевых слов (telegram+support, telegram+admin, service+support, system+admin, security+admin)
- Легитимные аккаунты проектов (например, @CompanySupportAdmin) теперь проходят проверку
- Сохранена детекция реальных фишинговых аккаунтов (например, @TelegramSupport, @ServiceSupport)

### Fixed

- Исправлены ложные срабатывания для аккаунтов проектов с сервисными именами

### Technical

- Добавлены методы `GetBlockedTelegramIds()` и `GetWhitelistedTelegramIds()` в `internal/config/cofig.go`
- Обновлен `internal/handler/middleware.go` с проверками черного и белого списков
- Добавлены тесты для валидных и подозрительных аккаунтов

## [3.2.9] - 2024-11-08

### Added

- Добавлена новая переменная в `.env` `TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY=day` для управления сбросом трафика триал юзеров (day/week/month/never)
- Для триал юзеров в "подключиться" добавлена информация о лимите трафика подписки

### Changed

- Для платных подписок сброс трафика каждый месяц
- Обновлены переводы

## [3.2.8] - 2024-10-28

### Added

- Добавлена текстовая ссылка на странице "подключиться" для web.telegram юзеров (у них не работает WebApp переход)

## [3.2.7] - 2024-10-28

### Fixed

- Исправлено: кнопка "подключиться" отсутствовала у клиентов с истекшей подпиской

## [3.2.6] - 2024-10-27

### Fixed

- Исправлен баг с `"deviceModel": null` в `devices.go` - бот мог ловить ошибки, когда в HWID прилетает `"deviceModel": null`

### Added

- Добавлена переменная окружения `HEALTH_CHECK_PORT` в `.env` (по умолчанию: 3) для проверки состояния бота и БД

## [3.2.5] - 2024-10-27

### Added

- Добавлены переводы для сообщения заблокированных юзеров с подозрительным ником (можно отредактировать в `en.json` и `ru.json`)

## [3.2.4] - 2024-10-26

### Fixed

- Исправлены баги по отслеживанию команд и сообщений юзеров
- Протестирована обратная совместимость с версиями Remnawave 2.0.0 - 2.0.8

### Changed

- Расширены возможности статистики реферальной системы:
  - **Приглашено**: общее количество рефералов
  - **Оплатили по вашей ссылке**: количество оплативших
  - **Дней заработано**: расчет из базы данных в реальном времени
  - Все данные сохраняются после перезапуска Docker

## [3.2.3 Enhanced] - 2024

### ✨ Новые возможности

#### 📱 Управление устройствами (My Devices)

- Добавлена кнопка "📱 Мои устройства" в меню подключения
- Просмотр списка всех HWID устройств в подписке
- Удаление устройств по клику
- Показ информации: номер, ID устройства, дата добавления
- Конфигурируемый лимит устройств через `HWID_FALLBACK_DEVICE_LIMIT`

#### 🎯 Расширенная реферальная статистика

- **Приглашено**: X — общее количество рефералов
- **Оплатили по вашей ссылке**: X — количество оплативших
- **Дней заработано**: X — расчет из базы данных в реальном времени
- Данные сохраняются после перезапуска Docker

#### 👨‍💼 Отслеживание пользователей для админа

- Глобальное отслеживание ВСЕХ команд (`/start`, `/panel`, `/admin` и т.д.)
- Пересылка всех сообщений админу без блокировки основного функционала
- Система ответов админа через Reply на пересланные сообщения

#### 🆘 Расширенная секция "Помощь"

- Новая кнопка "❓ Помощь" в главном меню
- Подменю с кнопками:
  - "🌏 Какой сервер выбрать"
  - "🆘 Поддержка"
  - "📄 Публичная оферта"
  - "⬅️ Назад" (возврат в главное меню)

### 🐛 Исправления

- **Исправлен баг**: команда `/start` теперь корректно отслеживается админом
- **Исправлен порядок регистрации обработчиков**: устранены конфликты между основной логикой и отслеживанием
- **Обновлены переводы**: корректно работают все 3 параметра в реферальной статистике

### 📋 Технические изменения

- Добавлен файл `internal/handler/devices.go` для управления устройствами
- Обновлен `internal/handler/referral.go` с расширенной статистикой
- Добавлены методы API: `GetUserInfo`, `GetUserDevicesByUuid`, `DeleteUserDevice`
- Добавлены методы БД: `CountPaidReferralsByReferrer`, `CalculateEarnedDays`
- Новые конфигурационные параметры: `HWID_FALLBACK_DEVICE_LIMIT`, `REFERRAL_DAYS`

### ⚙️ Обновленная главная клавиатура

```
[🔥 Попробовать бесплатно] (если новый пользователь)
[💰 Купить]
[🔌 Подключиться]
[🤝 Рефералы] [📊 Статус серверов]
[💬 Отзывы] [📢 Канал]
[❓ Помощь]
```

### 📚 Версии

- **Bot API**: 3.2.3
- **Remnawave API**: 2.1.19

### ⚠️ Важные примечания

- При обновлении проверьте переменную `REFERRAL_DAYS` в `.env` файле
- Значение по умолчанию для `REFERRAL_DAYS`: 15 дней
- При необходимости обновите `HWID_FALLBACK_DEVICE_LIMIT` в конфигурации

### 🔄 Измененные файлы

- `internal/handler/devices.go` (новый)
- `internal/handler/referral.go` (расширено)
- `internal/handler/start.go` (новое меню)
- `internal/handler/connect.go` (кнопка "Мои устройства")
- `internal/handler/handler.go` (отслеживание)
- `internal/remnawave/client.go` (API методы)
- `internal/database/referal.go` (статистика)
- `internal/config/cofig.go` (конфигурация)
- `cmd/app/main.go` (регистрация обработчиков)
- `translations/ru.json` и `translations/en.json` (переводы)
