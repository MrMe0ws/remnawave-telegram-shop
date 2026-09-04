package config

import (
	"strings"

	"remnawave-tg-shop-bot/internal/cabinet/deeplink"
	botcfg "remnawave-tg-shop-bot/internal/config"
)

// DeeplinkHappEncryptEnabled — CABINET_DEEPLINK_HAPP_ENCRYPT (runtime/env).
// По умолчанию false. При true подключение Happ отдаёт зашифрованный deep link
// (через API happ.su) вместо happ://add/, чтобы пользователь не мог
// смотреть/редактировать/шарить конфиги подписки в приложении.
func DeeplinkHappEncryptEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_DEEPLINK_HAPP_ENCRYPT")), "true")
}

// DeeplinkHappCryptVersion — CABINET_DEEPLINK_HAPP_CRYPT_VERSION (runtime/env).
// По умолчанию crypt5. crypt4 — для совместимости со старыми сборками Happ
// (4.x), которые нового формата не понимают и отвечают «URL подписки не
// валидна»; ценой того, что приватный ключ crypt4 давно опубликован.
func DeeplinkHappCryptVersion() string {
	return deeplink.NormalizeHappCryptVersion(botcfg.EffectiveEnv("CABINET_DEEPLINK_HAPP_CRYPT_VERSION"))
}

// DeeplinkIncyEncryptEnabled — CABINET_DEEPLINK_INCY_ENCRYPT (runtime/env).
// По умолчанию false. При true подключение INCY отдаёт обфусцированный deep link
// incy://crypt1/ вместо incy://add/ (скрытие ссылки от сканеров чатов/скриншотов).
func DeeplinkIncyEncryptEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_DEEPLINK_INCY_ENCRYPT")), "true")
}
