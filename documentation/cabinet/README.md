# Cabinet Docs Index

Единая точка входа по документации web-кабинета.

## Для владельца проекта (запуск с нуля)

- Полный пошаговый гайд (домен, DNS, SSL, nginx/caddy, OAuth, Telegram auth 1.0/2.0, migrations, env, translations):
  - `documentation/cabinet/SETUP-GUIDE-RU.md`

## Для обновления существующей установки

- Переход на версию с кабинетом:
  - `documentation/cabinet/cabinet-upgrade-guide.md`

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
