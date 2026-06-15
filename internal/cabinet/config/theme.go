package config

import (
	"strings"

	botcfg "remnawave-tg-shop-bot/internal/config"
)

// LightThemeEnabled — CABINET_LIGHT_THEME_ENABLED (runtime/env). По умолчанию true: светлая тема доступна.
func LightThemeEnabled() bool {
	v := strings.TrimSpace(botcfg.EffectiveEnv("CABINET_LIGHT_THEME_ENABLED"))
	if v == "" {
		return true
	}
	return strings.EqualFold(v, "true")
}
