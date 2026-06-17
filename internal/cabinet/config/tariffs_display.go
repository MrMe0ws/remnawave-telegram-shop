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
