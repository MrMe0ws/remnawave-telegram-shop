package config

import (
	"testing"

	botcfg "remnawave-tg-shop-bot/internal/config"
)

func TestTariffPriceDisplay(t *testing.T) {
	t.Run("default monthly", func(t *testing.T) {
		if got := TariffPriceDisplay(); got != TariffPriceDisplayMonthly {
			t.Fatalf("got %q", got)
		}
	})

	t.Run("marketing override", func(t *testing.T) {
		prev := botcfg.EffectiveEnv("CABINET_TARIFF_PRICE_DISPLAY")
		_, err := botcfg.ApplyRuntimePatch(map[string]string{
			"CABINET_TARIFF_PRICE_DISPLAY": TariffPriceDisplayMarketing,
		})
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			if prev == "" {
				_, _ = botcfg.ApplyRuntimePatch(map[string]string{
					"CABINET_TARIFF_PRICE_DISPLAY": "",
				})
				return
			}
			_, _ = botcfg.ApplyRuntimePatch(map[string]string{
				"CABINET_TARIFF_PRICE_DISPLAY": prev,
			})
		}()

		if got := TariffPriceDisplay(); got != TariffPriceDisplayMarketing {
			t.Fatalf("got %q", got)
		}
		if !IsTariffPriceDisplayMarketing() {
			t.Fatal("expected marketing mode")
		}
	})
}
