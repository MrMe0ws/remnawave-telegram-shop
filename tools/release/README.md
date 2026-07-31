# tools/release

Локальный CLI: GitHub Release + анонс в Telegram-форум из `RELEASE_NOTES.md`.

Не входит в Docker-образ магазина (сборка только `./cmd/app`; каталог `tools/` в `.dockerignore`).

## Setup

```bash
cp .env.release.sample .env.release
# заполни RELEASE_TG_BOT_TOKEN и при необходимости chat/thread
```

Бот должен быть админом супергруппы и иметь право писать в тему (`RELEASE_TG_MESSAGE_THREAD_ID`).

Если `api.telegram.org` резолвится в `198.18.*` (Clash fake-IP) — задай `RELEASE_TG_PROXY_URL` на локальный HTTP/SOCKS прокси (для FlClash обычно `http://127.0.0.1:7890`).

## Prerequisites before `github` / `publish`

- Нужные коммиты уже на целевой ветке (`main`), с которой `gh` возьмёт HEAD для нового тега.
- Если тег `vX.Y.Z` ещё не существует, `gh release create` создаст его на текущем HEAD remote default branch — убедись, что это нужный коммит.
- Повторный `github`/`publish` для того же тега упадёт (релиз уже есть); повторный `telegram` отправит дубликат поста.

## Commands

Из корня репозитория:

```bash
go run ./tools/release preview
go run ./tools/release github
go run ./tools/release telegram
go run ./tools/release publish
```

`publish` = `github` затем `telegram`.

## Recovery

Если `publish` создал GitHub Release, но Telegram упал:

```bash
go run ./tools/release telegram
```

Лимит текста Telegram — 4096 символов (руны); при превышении сократи блок «Вариант для Telegram».
