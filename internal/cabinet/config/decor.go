package config

import (
	"strings"

	botcfg "remnawave-tg-shop-bot/internal/config"
)

// ValidDecorThemeIDs — whitelist CABINET_DECOR_THEME (расширять при новых пресетах).
var ValidDecorThemeIDs = []string{
	"off",
	"green",
	"pink",
	"orange",
	"yellow",
	"neon",
	"new_year",
	"summer",
	"halloween",
	"valentine",
	"spring",
	"black_friday",
}

var validDecorThemes map[string]struct{}

func init() {
	validDecorThemes = make(map[string]struct{}, len(ValidDecorThemeIDs))
	for _, id := range ValidDecorThemeIDs {
		validDecorThemes[id] = struct{}{}
	}
}

// DecorTheme — CABINET_DECOR_THEME (runtime/env). По умолчанию off.
func DecorTheme() string {
	v := strings.TrimSpace(strings.ToLower(botcfg.EffectiveEnv("CABINET_DECOR_THEME")))
	if v == "" {
		return "off"
	}
	if _, ok := validDecorThemes[v]; ok {
		return v
	}
	return "off"
}

// ValidDecorThemes — копия whitelist для внешних пакетов.
func ValidDecorThemes() []string {
	out := make([]string, len(ValidDecorThemeIDs))
	copy(out, ValidDecorThemeIDs)
	return out
}

// IsValidDecorTheme — проверка значения enum.
func IsValidDecorTheme(value string) bool {
	_, ok := validDecorThemes[strings.TrimSpace(strings.ToLower(value))]
	return ok
}
