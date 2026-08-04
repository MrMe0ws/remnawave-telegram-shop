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
