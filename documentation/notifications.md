# Уведомления пользователям

## Истечение подписки

Раз в день (16:00 UTC) бот проверяет подписки, которые скоро закончатся:

- уведомление за **3 дня** до окончания;
- дата истечения + кнопка продления:
  - при `CABINET_TELEGRAM_UI_MODE=minimalism` и рабочем Mini App — WebApp `/cabinet/tariffs`;
  - иначе — сценарий «Купить» в боте;
- язык сообщения — предпочитаемый язык пользователя.

## Lifecycle-уведомления

Включаются через `LIFECYCLE_NOTIFY_ENABLED=true`. Расписание — `LIFECYCLE_CRON` (по умолчанию каждые 30 минут). Нужна миграция `000035_lifecycle_notify`.

### No-connect (paid / trial)

Напоминание тем, кто оплатил или взял триал, но **не подключался** к VPN (нет активности устройств в панели).

| Параметр | Смысл |
|----------|--------|
| `LIFECYCLE_NO_CONNECT_PAID_ENABLED` | Для оплативших |
| `LIFECYCLE_NO_CONNECT_TRIAL_ENABLED` | Для триала |
| `LIFECYCLE_NO_CONNECT_DELAY_HOURS` | Не слать раньше N часов после оплаты/триала |
| `LIFECYCLE_NO_CONNECT_MAX_AGE_HOURS` | Не слать позже этого окна |
| `LIFECYCLE_VIDEO_GUIDE_URL` | Кнопка с видео (опционально) |
| `LIFECYCLE_SUPPORT_CONTACT` | Контакт поддержки (опционально) |

### Win-back

Возврат пользователей с **истёкшей** подпиской (нужна хотя бы одна бывшая платная оплата; чистый триал не считается).

| Параметр | Смысл |
|----------|--------|
| `LIFECYCLE_WINBACK_ENABLED` | Вкл/выкл |
| `LIFECYCLE_WINBACK_DAYS_AFTER_EXPIRY` | Через сколько дней после окончания слать |
| `LIFECYCLE_WINBACK_DISCOUNT_PERCENT` | % скидки в промокоде |
| `LIFECYCLE_WINBACK_DISCOUNT_TTL_HOURS` | Срок жизни промокода |

Полный список переменных — [env.md](./env.md) (раздел Lifecycle).

## Torrent Blocker (Remnawave webhook)

Когда на ноде срабатывает [Node Plugin Torrent Blocker](https://docs.rw/learn/node-plugins/), панель шлёт админу увед в свою группу и может отправить webhook `torrent_blocker.report` на шоп. Шоп пишет клиенту в личку **от Telegram-бота** (бан на ноде + время разбана). Пользователя в панели не отключаем; отдельного уведа о разбане нет.

### Настройка

**Шоп** (`.env`):

```bash
REMNAWAVE_WEBHOOK_PATH=/remnawave-webhook
REMNAWAVE_WEBHOOK_SECRET=yourSecretOnlyAZaz09
```

Секрет: только `A-Za-z0-9` (ограничение панели). Путь без домена — как у YooKassa/Tribute.

**Панель Remnawave** (`.env` панели):

```bash
WEBHOOK_ENABLED=true
WEBHOOK_URL=https://your-shop-host:3002/remnawave-webhook
WEBHOOK_SECRET_HEADER=yourSecretOnlyAZaz09
```

`WEBHOOK_URL` должен быть доступен с хоста панели (публичный HTTPS или Docker-сеть). Можно несколько URL через запятую без пробелов. Порт в URL — `HEALTH_CHECK_PORT` шопа (в `.env.sample` / compose обычно `3002`; без env в бинаре — `8080`), если нет reverse-proxy на 443.

Перезапустите панель и шоп. В логах шопа при старте: `remnawave webhook mounted`.

### Проверка без торрента (curl с VDS)

Подставьте свой секрет, `telegramId` реального клиента бота и username вида `<customer_id>_<telegram_id>` из панели. Запрос можно слать **с VDS панели** на URL шопа (или `localhost`, если шоп на той же машине).

```bash
SECRET='yourSecretOnlyAZaz09'
URL='http://127.0.0.1:3002/remnawave-webhook'   # или https://shop.example.com/remnawave-webhook

# willUnblockAt = сейчас + 60 минут (UTC)
UNBLOCK=$(date -u -d '+60 minutes' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u -v+60M +%Y-%m-%dT%H:%M:%S.000Z)
PROCESSED=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

BODY=$(cat <<EOF
{"scope":"torrent_blocker","event":"torrent_blocker.report","timestamp":"${PROCESSED}","data":{"node":{"uuid":"00000000-0000-0000-0000-000000000001","name":"Латвия"},"user":{"uuid":"11111111-1111-1111-1111-111111111111","username":"42_694614437","telegramId":694614437},"report":{"actionReport":{"blocked":true,"ip":"203.0.113.10","blockDuration":3600,"willUnblockAt":"${UNBLOCK}","userId":"42","processedAt":"${PROCESSED}"},"xrayReport":{"email":"42_694614437","protocol":"bittorrent","network":"tcp","source":"203.0.113.10:12345","destination":"198.51.100.1:6881","inboundTag":"Latvia","outboundTag":"RW_TB_OUTBOUND_BLOCK","ts":0}}}}
EOF
)

SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
TS=$(date +%s)

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Remnawave-Signature: $SIG" \
  -H "X-Remnawave-Timestamp: $TS" \
  -d "$BODY"
echo
```

Ожидание: HTTP 200 `{"ok":true}` и сообщение в личке клиента от бота (кнопка «Мой VPN»; «Поддержка» — только если задан `SUPPORT_URL` или `FEEDBACK_URL`).  
Важно: HMAC считается по **точно тем же байтам**, что уходят в `-d "$BODY"` — не переформатируйте JSON между подписью и отправкой.  
`telegramId` должен быть у пользователя в БД шопа; иначе в логах будет `customer not found` (ответ всё равно `{"ok":true}`, чтобы панель не ретраила).

### Живой E2E (опционально)

Полный туннель VPN на ноде с плагином → запустить торрент → админ-увед панели → личка от бота. Xray детектит не весь BT-трафик; без полного туннеля бан часто не сработает.
