# Обратный прокси

Бот слушает `HEALTH_CHECK_PORT` (healthcheck, кабинет, вебхуки оплат). Снаружи этот порт лучше не открывать напрямую — поставьте nginx, Caddy или Traefik.

Для web-кабинета с доменом и SSL удобнее следовать гайду:

- [cabinet/SETUP-GUIDE-RU.md](./cabinet/SETUP-GUIDE-RU.md)
- пункт меню установщика `scripts/meows-shop-setup.sh` → **Reverse-proxy / SSL**

## Пример Traefik

Если не используете ngrok из `docker-compose`, можно так:

```yaml
http:
  routers:
    remnawave-telegram-shop:
      rule: "Host(`bot.example.com`)"
      entrypoints:
        - http
      middlewares:
        - redirect-to-https
      service: remnawave-telegram-shop

    remnawave-telegram-shop-secure:
      rule: "Host(`bot.example.com`)"
      entrypoints:
        - https
      tls:
        certResolver: letsencrypt
      service: remnawave-telegram-shop

  middlewares:
    redirect-to-https:
      redirectScheme:
        scheme: https

  services:
    remnawave-telegram-shop:
      loadBalancer:
        servers:
          - url: "http://bot:82251"
```

Подставьте свой хост и порт сервиса из вашего `docker-compose` (значение `HEALTH_CHECK_PORT` / проброс порта контейнера).
