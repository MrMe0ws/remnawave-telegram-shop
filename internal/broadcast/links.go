package broadcast

import (
	"net/url"
	"strings"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	botcfg "remnawave-tg-shop-bot/internal/config"
)

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

// CabinetLink — раздел, который можно прикрепить к рассылке отдельной кнопкой.
// Key — стабильный идентификатор для API и web-админки, TranslationKey — подпись кнопки
// на языке получателя.
type CabinetLink struct {
	Key            string
	TranslationKey string

	// resolveURL возвращает целевой URL либо "" — тогда кнопка не рисуется.
	// Так же гасятся разделы, выключенные в конфиге (колесо фортуны, поддержка без SUPPORT_URL).
	resolveURL func() string

	// webApp — открывать внутри Telegram как mini app. Внешние ссылки (поддержка) — обычные URL-кнопки.
	webApp bool
}

func cabinetSection(path string) func() string {
	return func() string { return cabinetWebAppURL(path) }
}

// cabinetLinks задаёт и список доступных разделов, и порядок кнопок в клавиатуре.
var cabinetLinks = []CabinetLink{
	{Key: "dashboard", TranslationKey: "broadcast_link_dashboard", resolveURL: cabinetSection("/cabinet/dashboard"), webApp: true},
	{Key: "tariffs", TranslationKey: "broadcast_link_tariffs", resolveURL: cabinetSection("/cabinet/tariffs"), webApp: true},
	{Key: "connections", TranslationKey: "broadcast_link_connections", resolveURL: cabinetSection("/cabinet/connections"), webApp: true},
	{Key: "accounts", TranslationKey: "broadcast_link_accounts", resolveURL: cabinetSection("/cabinet/accounts"), webApp: true},
	{Key: "profile", TranslationKey: "broadcast_link_profile", resolveURL: cabinetSection("/cabinet/profile"), webApp: true},
	{Key: "payments", TranslationKey: "broadcast_link_payments", resolveURL: cabinetSection("/cabinet/payments"), webApp: true},
	{Key: "promocodes", TranslationKey: "broadcast_link_promocodes", resolveURL: cabinetSection("/cabinet/promocodes"), webApp: true},
	{Key: "referral", TranslationKey: "broadcast_link_referral", resolveURL: cabinetSection("/cabinet/referral"), webApp: true},
	{Key: "partner", TranslationKey: "broadcast_link_partner", resolveURL: cabinetSection("/cabinet/partner"), webApp: true},
	{Key: "loyalty", TranslationKey: "broadcast_link_loyalty", resolveURL: cabinetSection("/cabinet/loyalty"), webApp: true},
	{Key: "fortune", TranslationKey: "broadcast_link_fortune", resolveURL: fortuneURL, webApp: true},
	{Key: "support", TranslationKey: "support_button", resolveURL: supportURL},
}

// fortuneURL гасит кнопку, пока колесо выключено (FORTUNE_ENABLED) — иначе получатель
// откроет пустой раздел.
func fortuneURL() string {
	if !cabcfg.GetFortuneWheel().Enabled {
		return ""
	}
	return cabinetWebAppURL("/cabinet/fortune")
}

// supportURL — внешняя ссылка на чат поддержки из SUPPORT_URL, не раздел кабинета.
func supportURL() string {
	return strings.TrimSpace(botcfg.SupportURL())
}

// CabinetLinks возвращает разделы в порядке отрисовки кнопок.
func CabinetLinks() []CabinetLink {
	out := make([]CabinetLink, len(cabinetLinks))
	copy(out, cabinetLinks)
	return out
}

// IsCabinetLinkKey сообщает, известен ли ключ раздела (валидация входа API).
func IsCabinetLinkKey(key string) bool {
	for _, link := range cabinetLinks {
		if link.Key == key {
			return true
		}
	}
	return false
}

// NormalizeCabinetLinkKeys оставляет только известные ключи, без дублей,
// в порядке cabinetLinks — чтобы клавиатура не зависела от порядка галочек в админке.
func NormalizeCabinetLinkKeys(keys []string) []string {
	if len(keys) == 0 {
		return nil
	}
	selected := make(map[string]bool, len(keys))
	for _, key := range keys {
		selected[strings.TrimSpace(key)] = true
	}
	var out []string
	for _, link := range cabinetLinks {
		if selected[link.Key] {
			out = append(out, link.Key)
		}
	}
	return out
}
