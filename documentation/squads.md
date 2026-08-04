# Squads Remnawave

Squad — группа методов подключения / узлов в панели Remnawave. Бот назначает их пользователям при создании и обновлении подписки.

## Платные пользователи

### Внутренние (`SQUAD_UUIDS`)

- Список UUID через запятую.
- Если задано — назначаются только эти squads.
- Если пусто или нет совпадений — назначаются все доступные internal squads с панели.

### Внешний (`EXTERNAL_SQUAD_UUID`)

- Один UUID внешнего squad.
- Попадает во все запросы создания/обновления пользователя в Remnawave.
- Неверный формат UUID — бот не стартует.
- Пусто — внешний squad не назначается.

## Пробные пользователи

Можно изолировать триал от платных:

| Переменная | Смысл |
|------------|--------|
| `TRIAL_INTERNAL_SQUADS` | UUID internal squads через запятую; пусто → fallback на `SQUAD_UUIDS` |
| `TRIAL_EXTERNAL_SQUAD_UUID` | Один external UUID; пусто → fallback на `EXTERNAL_SQUAD_UUID` |

**Зачем:** отдельный мониторинг, лимиты ресурсов или тест функций только на триале.

Пример:

```env
SQUAD_UUIDS=773db654-a8b2-413a-a50b-75c3536238fd
TRIAL_INTERNAL_SQUADS=bc979bdd-f1fa-4d94-8a51-38a0f518a2a2
TRIAL_EXTERNAL_SQUAD_UUID=773db654-a8b2-413a-a50b-75c3536238fd
```

В режиме `SALES_MODE=tariffs` squads также задаются **на уровне тарифа** в админке; env остаётся базой для сида и classic-логики. См. [sales-modes.md](./sales-modes.md).
