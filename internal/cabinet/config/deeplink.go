package config

import (
	"strings"

	botcfg "remnawave-tg-shop-bot/internal/config"
)

// DeeplinkHappEncryptEnabled — CABINET_DEEPLINK_HAPP_ENCRYPT (runtime/env).
// По умолчанию false. При true подключение Happ отдаёт зашифрованный deep link
// happ://crypt5/ (через API happ.su) вместо happ://add/, чтобы пользователь не мог
// смотреть/редактировать/шарить конфиги подписки в приложении.
func DeeplinkHappEncryptEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_DEEPLINK_HAPP_ENCRYPT")), "true")
}

// DeeplinkIncyEncryptEnabled — CABINET_DEEPLINK_INCY_ENCRYPT (runtime/env).
// По умолчанию false. При true подключение INCY отдаёт обфусцированный deep link
// incy://crypt1/ вместо incy://add/ (скрытие ссылки от сканеров чатов/скриншотов).
func DeeplinkIncyEncryptEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_DEEPLINK_INCY_ENCRYPT")), "true")
}
