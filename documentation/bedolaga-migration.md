# Миграция с Bedolaga

Перенос клиентов, тарифов и рефералов из [Bedolaga](https://github.com/BEDOLAGA-DEV/remnawave-bedolaga-telegram-bot) в Meows Remnawave Telegram Shop.

## Совместимость (важно)

| | |
|--|--|
| **Цель миграции** | Meows-бот + панель **Remnawave 2.8.\*** ([compatibility.md](./compatibility.md)) |
| **Источник Bedolaga** | И **3.x** (напр. 3.60), и **4.0+** — версия бота Bedolaga сама по себе не блокер |

Разница поколений Bedolaga:

| Bedolaga | Обычно панель Remnawave | Для Meows |
|----------|-------------------------|-----------|
| **3.x** (напр. 3.60) | до 3.0 (ветка 2.x) | Нормальный кейс: same-panel 2.8.* |
| **4.0+** | **3.0+** | Данные в БД Meows переносим; API Meows рассчитан на **2.8.\***, не на RW 3.0 |

Мигратор:

- читает схему источника гибко (опциональные колонки 3.x / 4.x);
- в dry-run пишет `compat_warning` и `bedolaga_generation_hint` в `summary.json`;
- wizard спрашивает подтверждение, что Remnawave для Meows — **2.8.\***.

Главное — корректный перенос данных. Если админ сидел на Bedolaga 4 + RW 3.0, а Meows подключает к RW 2.8 — это уже смена панели (не «тихий» same-panel).

## Что переносится

| Источник Bedolaga | Куда | Примечание |
|-------------------|------|------------|
| Тарифы | `tariff` / `tariff_price` | Имя, цены (→ 1/3/6/12 мес), internal/external squads, лимиты |
| Юзеры с Telegram | `customer` | Тариф, срок, language, username |
| Юзеры без TG (email/OAuth) | `customer` web-only + `cabinet_account` | Synthetic telegram_id; пароль только если `$argon2id$` |
| Баланс (кошелёк) | Срок подписки | Дни = `баланс_₽ × 30 / цена_1м_тарифа_юзера`; итог `max(дни_RW, дни_баланса)` |
| Реф.граф | `referral` | По telegram_id |

**Remnawave (same-panel 2.8.\*):** по умолчанию только чтение. На шаге balance — только удлинение `expireAt`, если он короче целевого. Сквады, трафик, теги не меняются. Новые VPN-юзеры не создаются.

**Не переносится:** wallet как сущность, autopay, daily-биллинг, история платежей, withdrawals.

## Быстрый старт (рекомендуется)

На Linux-сервере с клоном репозитория и Docker:

```bash
cd /opt/remnawave-telegram-shop   # или ваш путь
chmod +x scripts/meows-bedolaga-migrate.sh
./scripts/meows-bedolaga-migrate.sh
```

Меню проведёт по шагам:

1. Источник (файл `pg_dump` → temp Postgres, или готовый DSN)
2. Подтверждение Remnawave **2.8.\*** + запись `migrate.yaml`
3. Dry-run → CSV в `migrate-out/` (смотрите `compat_warning`)
4. Apply: тарифы → клиенты → баланс (RW) → рефералы

Нужен **Go** на машине (`go run ./tools/migrate-bedolaga`), либо заранее собранный бинарь в `MEOWS_MIGRATE_BIN`.

## Бэкап Bedolaga

### Вариант A — `pg_dump` (предпочтительно)

На сервере Bedolaga:

```bash
docker compose exec -T postgres pg_dump -U bedolaga -d bedolaga --no-owner \
  | gzip > bedolaga-$(date +%F).sql.gz
```

Скопируйте файл на сервер с Meows и укажите путь в пункте 1 меню.

### Вариант B — бекап из админки Bedolaga

У Bedolaga есть свой «Создать бекап» в админ-меню бота (их формат). Восстановите его их инструментом «Восстановить» в temp-инстанс / Postgres, затем в меню мигратора выберите «уже есть DSN».

## Прямой вызов движка

```bash
cp tools/migrate-bedolaga/migrate.yaml.example migrate.yaml
# отредактируйте DSN / Remnawave token (панель 2.8.*)

go run ./tools/migrate-bedolaga -config migrate.yaml -dry-run -step all
go run ./tools/migrate-bedolaga -config migrate.yaml -apply -step tariffs
go run ./tools/migrate-bedolaga -config migrate.yaml -apply -step customers
go run ./tools/migrate-bedolaga -config migrate.yaml -apply -step balance
go run ./tools/migrate-bedolaga -config migrate.yaml -apply -step referrals
```

Отчёты: `migrate-out/summary.json`, `customers.csv`, `tariffs.csv`, `balances.csv`, `problems.csv`.

## Важные коды в problems.csv

| code | Смысл |
|------|--------|
| `compat_warning` | Подсказка 3.x/4.x Bedolaga и Remnawave 2.8 vs 3.0 |
| `rw_missing` | Юзер не найден в Remnawave — customer создан, VPN не трогали |
| `cabinet_password_reset_required` | Хеш пароля не argon2id — нужен сброс в кабинете |
| `multi_sub` | Несколько активных подписок Bedolaga — взята одна |
| `balance_would_extend` / extend | Планируется / выполнено удлинение expire в RW |
| `referral_partial` | Нет telegram mapping у реферера/реферала |
| `daily_tariff` | Daily-тариф импортирован как обычный |

## Требования к целевому боту

- Схема БД актуальна (миграции при старте бота)
- Желательно `SALES_MODE=tariffs`
- Remnawave **2.8.\*** (та же панель, к которой ходит Meows)
- Перед apply лучше остановить бота Bedolaga, чтобы не плодить новые оплаты в старую БД
