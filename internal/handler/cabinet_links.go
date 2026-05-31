package handler

import (
	"net/url"
	"strings"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
)

// BuildCabinetWebAppURL exported версия для использования вне пакета handler
func BuildCabinetWebAppURL(path string) string {
	return cabinetWebAppURL(path)
}

func cabinetWebAppURL(path string) string {
	entry := strings.TrimSpace(cabcfg.MiniAppEntryURL())
	if entry == "" || !strings.HasPrefix(path, "/") {
		return ""
	}
	base, err := url.Parse(entry)
	if err != nil {
		return ""
	}
	target, err := url.Parse(path)
	if err != nil {
		return ""
	}
	return base.ResolveReference(target).String()
}
