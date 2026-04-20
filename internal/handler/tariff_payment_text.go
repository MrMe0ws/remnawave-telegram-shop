package handler

import (
	"context"
	"fmt"
	"strings"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

func (h Handler) tariffMinPriceLabel(ctx context.Context, lang string, tariffID int64) string {
	minRub, okRub, _ := h.tariffRepository.MinAmountRubForTariff(ctx, tariffID)
	if okRub && minRub > 0 {
		return fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_from_rub"), minRub)
	}
	return ""
}

func tariffTrafficLabel(lang string, t *database.Tariff, tr interface{ GetText(string, string) string }) string {
	if t.TrafficLimitBytes <= 0 {
		return tr.GetText(lang, "payment_tariff_traffic_unlim")
	}
	gb := t.TrafficLimitBytes / bytesInGB()
	return fmt.Sprintf(tr.GetText(lang, "payment_tariff_traffic_gb"), gb)
}

func (h Handler) currentTariffName(ctx context.Context, lang string, customer *database.Customer) string {
	var currentName string
	if customer != nil && customer.CurrentTariffID != nil && *customer.CurrentTariffID > 0 {
		t, err := h.tariffRepository.GetByID(ctx, *customer.CurrentTariffID)
		if err == nil && t != nil {
			currentName = escapeHTML(displayTariffName(t))
		}
	}
	if currentName == "" {
		currentName = escapeHTML(h.translation.GetText(lang, "payment_tariff_current_unknown"))
	}
	return currentName
}

// buildTariffBuySelectionHTML главный экран "Купить" в SALES_MODE=tariffs.
func (h Handler) buildTariffBuySelectionHTML(ctx context.Context, lang string, customer *database.Customer) (string, error) {
	var sb strings.Builder
	sb.WriteString(h.translation.GetText(lang, "buy_tariff_pick_title"))
	sb.WriteString("\n\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_current_line"), h.currentTariffName(ctx, lang, customer)))
	sb.WriteString("\n\n")
	tariffs, err := h.tariffRepository.ListActive(ctx)
	if err != nil {
		return "", err
	}
	for i := range tariffs {
		t := &tariffs[i]
		if i > 0 {
			sb.WriteString("\n\n")
		}
		nameEsc := escapeHTML(displayTariffName(t))
		pricePart := h.tariffMinPriceLabel(ctx, lang, t.ID)
		if pricePart == "" {
			pricePart = h.translation.GetText(lang, "payment_tariff_price_na")
		}
		sb.WriteString(fmt.Sprintf("<b>%s</b> — %s / %d 📱 %s",
			nameEsc,
			tariffTrafficLabel(lang, t, h.translation),
			t.DeviceLimit,
			pricePart,
		))
		if t.Description != nil && strings.TrimSpace(*t.Description) != "" {
			sb.WriteString("\n")
			sb.WriteString(strings.TrimSpace(*t.Description))
		}
	}
	return sb.String(), nil
}

func (h Handler) buildTariffPeriodChoiceHTML(ctx context.Context, lang string, t *database.Tariff) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "tariff_period_screen_title"), escapeHTML(displayTariffName(t))))
	sb.WriteString("\n\n")
	sb.WriteString(h.translation.GetText(lang, "tariff_period_params_title"))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "tariff_selected_traffic_line"), tariffTrafficLabel(lang, t, h.translation)))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "tariff_selected_devices_line"), t.DeviceLimit))
	if t.Description != nil && strings.TrimSpace(*t.Description) != "" {
		sb.WriteString("\n")
		sb.WriteString(strings.TrimSpace(*t.Description))
	}
	sb.WriteString("\n\n")
	sb.WriteString(h.translation.GetText(lang, "tariff_choose_period"))
	return sb.String()
}

func (h Handler) buildTariffPaymentMethodsHTML(lang string) string {
	return h.translation.GetText(lang, "tariff_payment_methods_text")
}

// switchTariffKind: "" | "upgrade" | "downgrade" — для строк бонуса при смене тарифа (только если upgradeBonusDays > 0).
func (h Handler) buildTariffCheckoutSummaryHTML(ctx context.Context, lang string, customer *database.Customer, tariffID int64, month, payAmount int, invoiceStars bool, upgradeBonusDays int, extraHwid int, switchTariffKind string) (string, error) {
	t, err := h.tariffRepository.GetByID(ctx, tariffID)
	if err != nil || t == nil {
		return "", err
	}
	dim := config.DaysInMonth()
	if dim <= 0 {
		dim = 30
	}
	days := month * dim
	totalSubDays := days + upgradeBonusDays
	traf := tariffTrafficLabel(lang, t, h.translation)
	var sb strings.Builder
	if upgradeBonusDays > 0 && switchTariffKind != "" {
		sb.WriteString(h.translation.GetText(lang, "payment_tariff_checkout_order_header"))
		sb.WriteString("\n\n")
	}
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_tariff_line"), escapeHTML(displayTariffName(t))))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_period"), days))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_traffic"), traf))
	sb.WriteString("\n")
	if extraHwid > 0 {
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_devices_with_extra"), t.DeviceLimit, extraHwid))
	} else {
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_devices"), t.DeviceLimit))
	}
	sb.WriteString("\n")
	if upgradeBonusDays > 0 && switchTariffKind == "upgrade" {
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_bonus_upgrade_line"), upgradeBonusDays))
		sb.WriteString("\n")
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_total_days_line"), totalSubDays))
		sb.WriteString("\n")
	} else if upgradeBonusDays > 0 && switchTariffKind == "downgrade" {
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_bonus_downgrade_line"), upgradeBonusDays))
		sb.WriteString("\n")
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_total_days_line"), totalSubDays))
		sb.WriteString("\n")
	}
	if invoiceStars {
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_amount_stars"), payAmount))
	} else {
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "payment_tariff_checkout_amount_rub"), payAmount))
	}
	if config.LoyaltyEnabled() && h.loyaltyTierRepository != nil && customer != nil {
		if pct, err := h.loyaltyTierRepository.DiscountPercentForXP(ctx, customer.LoyaltyXP); err == nil && pct > 0 {
			sb.WriteString("\n")
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "tariff_pay_loyalty_line"), pct))
		}
	}
	return sb.String(), nil
}
