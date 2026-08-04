# Кастомизация: тексты, кнопки, интерфейс

## Как меняются кнопки меню бота

Основные кнопки («Купить», подключение к VPN) всегда на месте.  
Дополнительные появляются только если задан URL в `.env`:

| Переменная | Кнопка |
|------------|--------|
| `SERVER_STATUS_URL` | Статус сервера |
| `SUPPORT_URL` | Поддержка (в кабинете при `SUPPORT_BOT_API=true` — встроенный чат) |
| `FEEDBACK_URL` | Отзывы |
| `CHANNEL_URL` | Канал |
| `TOS_URL` / `PUBLIC_OFFER_URL` / `PRIVACY_POLICY_URL` / `TERMS_OF_SERVICE_URL` | Юридические ссылки в «Помощь» |
| `VIDEO_GUIDE_URL` | Видеоинструкция в «Помощь» |
| `SERVER_SELECTION_URL` | «Какой сервер выбрать» в «Помощь» |

В режиме меню `minimalism` (`CABINET_TELEGRAM_UI_MODE`) кнопки канала/отзывов ещё зависят от `CABINET_TELEGRAM_SHOW_*_BUTTON`. Часть ссылок можно менять из web-админки без рестарта.

## Тексты Telegram-бота

Папка `translations/`:

- `ru.json`, `en.json` — пользовательские строки;
- `admin_ru.json`, `admin_en.json` — админские.

После правок перезапустите контейнер бота.

## Тексты web-кабинета

1. Редактируйте `web/cabinet/src/i18n/ru.json` и/или `en.json`.
2. В Docker должен быть volume вроде `./web/cabinet/src/i18n:/translations/cabinet/i18n` (см. `docker-compose.yaml`).
3. Перезапустите бота и обновите страницу в браузере.

Пересборка образа нужна при изменении **кода** React/Go, не при правке этих JSON.  
Чтобы строки попали в fallback внутри бандла: `cd web/cabinet && npm run build`, затем пересборка образа.

Контент FAQ / app-config: `translations/cabinet/` — см. [cabinet/README.md](./cabinet/README.md).

## Цвет и custom emoji у кнопок

В `translations/*.json` кнопка может быть строкой или объектом:

```json
{
  "buy_button": {
    "text": "💰 Купить",
    "style": "blue",
    "emoji_id": "1234567890123456789"
  }
}
```

### Значения `style`

- `blue` (алиас `primary`)
- `green` (алиас `success`, также `sucess`)
- `red` (алиас `danger`)

Если `style` не указан — цвет не применяется. Ошибочный стиль игнорируется.

### Про `emoji_id`

Это ID **кастомного** emoji Telegram (не обычный Unicode). Берётся из объектов Telegram API при выборе custom emoji.
