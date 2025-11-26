# Инструкция по использованию Docker образа

## Авторизация в GitHub Container Registry

Если пакет приватный, нужно авторизоваться в Docker:

```bash
# Создайте Personal Access Token с правами read:packages
# Затем выполните:
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

Или добавьте в `~/.docker/config.json`:

```json
{
  "auths": {
    "ghcr.io": {
      "auth": "BASE64_ENCODED_USERNAME:TOKEN"
    }
  }
}
```

## Использование образа

### Production (готовый образ из GitHub Packages)

```bash
docker compose up -d
```

Использует образ: `ghcr.io/mrmeows/remnawave-telegram-shop-bot:latest`

### Development (локальная сборка)

```bash
docker compose -f docker-compose.dev.yaml up -d
```

## Проверка доступности образа

```bash
docker pull ghcr.io/mrmeows/remnawave-telegram-shop-bot:latest
```

## Использование конкретной версии

В `docker-compose.yaml` замените:

```yaml
image: ghcr.io/mrmeows/remnawave-telegram-shop-bot:latest
```

На нужную версию, например:

```yaml
image: ghcr.io/mrmeows/remnawave-telegram-shop-bot:3.4.0
```
