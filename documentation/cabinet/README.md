# Cabinet Docs Index

Единая точка входа по документации web-кабинета.

## Для владельца проекта (запуск с нуля)

- Полный пошаговый гайд (домен, DNS, SSL, nginx/caddy, OAuth, Telegram auth 1.0/2.0, migrations, env, translations):
  - `documentation/cabinet/SETUP-GUIDE-RU.md`

## Для обновления существующей установки

- Переход на версию с кабинетом:
  - `documentation/cabinet/cabinet-upgrade-guide.md`

## Чат поддержки (bridge к telegram-support-bot)

- Встроенный чат в кабинете при `SUPPORT_BOT_API=true` (миграция `000036_cabinet_support`).
- Настройка env, Docker-сеть shop ↔ support-bot, smoke-проверка:
  - `documentation/cabinet/SETUP-GUIDE-RU.md` — раздел **«18) Чат поддержки (support bridge)»**
- Документация support-bot: `README.md` в репозитории [telegram-support-bot](https://github.com/Jolymmiels/telegram-support-bot).

## Runtime и контент

- Контент из `/translations/cabinet/*`:
  - `GET /cabinet/api/content/faq` -> `translations/cabinet/FAQ.json`
  - `GET /cabinet/api/content/app-config` -> `translations/cabinet/app-config.json`
- Для изменения runtime-контента без ребилда используйте volume:
  - `./translations:/translations`

## Быстрые проверки после изменений

- Фронтенд:
  - `cd web/cabinet && npm run typecheck && npm run build`
- Backend cabinet:
  - `go test ./internal/cabinet/http/...`
