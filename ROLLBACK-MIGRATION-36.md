# Откат миграции 000036 (customer_notification_preferences)

## Контекст
Миграция `000036_customer_notification_preferences` была удалена из кодовой базы (откат к коммиту `7845c62`).
Если она была применена в продакшен БД, нужно откатить её вручную.

## Проверка применена ли миграция

```sql
SELECT version, dirty FROM schema_migrations WHERE version = 36;
```

Если запрос вернул строку → миграция применена, нужен откат.

## Откат в продакшен БД

### Вариант 1: Через migrate CLI (рекомендуется)

```bash
migrate -database "postgres://USER:PASS@HOST:PORT/DBNAME?sslmode=require" \
        -path ./db/migrations \
        down 1
```

**⚠️ Внимание:** Эта команда откатит **последнюю** применённую миграцию. 
Убедитесь, что последняя миграция = 36!

### Вариант 2: Вручную через SQL

```sql
-- 1. Удалить таблицу
DROP TABLE IF EXISTS customer_notification_preferences;

-- 2. Удалить запись из schema_migrations
DELETE FROM schema_migrations WHERE version = 36;
```

## Проверка успешного отката

```sql
-- Таблица не должна существовать
SELECT * FROM customer_notification_preferences LIMIT 1;
-- Ожидаемый результат: ERROR:  relation "customer_notification_preferences" does not exist

-- Миграция не должна быть в истории
SELECT version FROM schema_migrations WHERE version = 36;
-- Ожидаемый результат: 0 rows
```

## После отката

После отката миграции в БД можно безопасно деплоить код с коммита `7845c62` и новее (без 4.9.0).

---
**Дата:** 2026-05-31  
**Причина:** Откат системы Notification Preferences (MVP не готов)
