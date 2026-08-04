# Обновление

На сервере в каталоге проекта:

```bash
docker compose pull
docker compose down && docker compose up -d
```

После смены переменных в `.env` пересоздайте контейнер:

```bash
docker compose up -d --force-recreate
```

## Кабинет

Обновление существующей установки с кабинетом:

- [cabinet/cabinet-upgrade-guide.md](./cabinet/cabinet-upgrade-guide.md)

Интерактивный установщик также умеет управлять ботом и гонять smoke-проверки:

```bash
./scripts/meows-shop-setup.sh
```
