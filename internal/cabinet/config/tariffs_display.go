package config

import (
	"strings"

	botcfg "remnawave-tg-shop-bot/internal/config"
)

const (
	TariffPriceDisplayMonthly   = "monthly"
	TariffPriceDisplayMarketing = "marketing"
)

// TariffPriceDisplay — CABINET_TARIFF_PRICE_DISPLAY (runtime/env): monthly | marketing.
func TariffPriceDisplay() string {
	v := strings.ToLower(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_TARIFF_PRICE_DISPLAY")))
	if v == TariffPriceDisplayMarketing {
		return TariffPriceDisplayMarketing
	}
	return TariffPriceDisplayMonthly
}

// IsTariffPriceDisplayMarketing — витрина тарифов показывает ₽/мес при оплате за 12 месяцев.
func IsTariffPriceDisplayMarketing() bool {
	return TariffPriceDisplay() == TariffPriceDisplayMarketing
}

const (
	TariffSavingsBadgeNone     = "none"
	TariffSavingsBadgeCorner   = "corner"
	TariffSavingsBadgeOldPrice = "old_price"
)

// TariffSavingsBadge — CABINET_TARIFF_SAVINGS_BADGE (runtime/env): none | corner | old_price.
//
// Плашка «−N %» на карточках сроков (шаг 2 витрины). Процент считается на
// фронте от «цена 1 мес × N» — так же, как в редакторе тарифа в админке.
// Отдельно от SHOW_LONG_TERM_SAVINGS_PERCENT: та настройка правит кнопки в боте.
func TariffSavingsBadge() string {
	switch strings.ToLower(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_TARIFF_SAVINGS_BADGE"))) {
	case TariffSavingsBadgeCorner:
		return TariffSavingsBadgeCorner
	case TariffSavingsBadgeOldPrice:
		return TariffSavingsBadgeOldPrice
	default:
		return TariffSavingsBadgeNone
	}
}
