# Cabinet Notes (runtime)

Короткая памятка по текущему состоянию web-кабинета.

## Тема

- Кабинет поддерживает **dark/light**.
- Инициализация темы: `web/cabinet/src/main.tsx` (`cab_theme` + `prefers-color-scheme`).

## Runtime-контент из translations

- Файлы контента читаются backend-ом на лету из `/translations/cabinet/*`:
  - `GET /cabinet/api/content/faq` -> `FAQ.json`
  - `GET /cabinet/api/content/app-config` -> `app-config.json`
- Для Docker без ребилда обязателен mount:
  - `./translations:/translations`

## Страница установки устройств

- Маршрут: `/cabinet/connections`.
- Данные и порядок платформ берутся из `translations/cabinet/app-config.json`.
- Кнопка «Добавить подписку»: см. **`docs/cabinet/README.md`** (сырый URL для `happ://add/`, `v2raytun://import/`, `v2rayn://import/`; `encodeURIComponent` для схем с `?url=` / `&url=`; при `isNeedBase64Encoding=true` — Base64).

## После изменений

- Проверка фронта: `cd web/cabinet && npm run typecheck`
- Для backend-роутов кабинета: `go test ./internal/cabinet/http/...`
