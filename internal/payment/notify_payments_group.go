package payment

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"

	"github.com/go-telegram/bot"
	"github.com/google/uuid"
)

func invoiceTypeTitle(t database.InvoiceType) string {
	switch t {
	case database.InvoiceTypeYookasa:
		return "YooKassa"
	case database.InvoiceTypeCrypto:
		return "Crypto Pay"
	case database.InvoiceTypeTelegram:
		return "Telegram Stars"
	case database.InvoiceTypeTribute:
		return "Tribute"
	default:
		return string(t)
	}
}

func ptrTimeIfValid(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

func formatDateDMYUTC(t *time.Time) string {
	if t == nil {
		return "—"
	}
	u := t.UTC()
	return fmt.Sprintf("%02d.%02d.%04d", u.Day(), u.Month(), u.Year())
}

func formatClockUTC(t time.Time) string {
	u := t.UTC()
	return fmt.Sprintf("%02d:%02d:%02d UTC", u.Hour(), u.Minute(), u.Second())
}

func telegramUsernameLine(c *database.Customer) string {
	if c == nil {
		return "(нет username)"
	}
	if c.TelegramUsername != nil {
		u := strings.TrimSpace(*c.TelegramUsername)
		if u != "" {
			if !strings.HasPrefix(u, "@") {
				return "@" + u
			}
			return u
		}
	}
	return "(нет username)"
}

func paymentLinkBlock(p *database.Purchase) string {
	if p == nil {
		return "🔗 платёж: —"
	}
	switch p.InvoiceType {
	case database.InvoiceTypeYookasa:
		if p.YookasaID != nil && *p.YookasaID != uuid.Nil {
			return fmt.Sprintf("🔗 платёж: %s (можно скопировать)", p.YookasaID.String())
		}
	case database.InvoiceTypeCrypto:
		if p.CryptoInvoiceID != nil {
			line := fmt.Sprintf("🔗 платёж: %d (можно скопировать)", *p.CryptoInvoiceID)
			if p.CryptoInvoiceLink != nil && strings.TrimSpace(*p.CryptoInvoiceLink) != "" {
				line += "\n   " + strings.TrimSpace(*p.CryptoInvoiceLink)
			}
			return line
		}
	case database.InvoiceTypeTelegram:
		if p.CryptoInvoiceLink != nil && strings.TrimSpace(*p.CryptoInvoiceLink) != "" {
			return "🔗 счёт Stars:\n   " + strings.TrimSpace(*p.CryptoInvoiceLink)
		}
	}
	return "🔗 платёж: —"
}

func cabinetWebHint(cabinet bool, c *database.Customer) string {
	src := "бот"
	if cabinet {
		src = "кабинет"
	}
	var tags []string
	if c != nil && c.IsWebOnly {
		tags = append(tags, "web-only")
	}
	if c != nil && utils.IsSyntheticTelegramID(c.TelegramID) {
		tags = append(tags, "synthetic tg")
	}
	if len(tags) == 0 {
		return "🌐 " + src
	}
	return "🌐 " + src + " · " + strings.Join(tags, " · ")
}

func amountPeriodLine(p *database.Purchase) string {
	if p == nil {
		return "💳 —"
	}
	cur := strings.TrimSpace(p.Currency)
	if cur == "" {
		cur = "RUB"
	}
	amt := p.Amount
	if p.InvoiceType == database.InvoiceTypeTelegram {
		if cur == "" {
			cur = "XTR"
		}
		return fmt.Sprintf("💳 %.0f ⭐ · %s", amt, cur)
	}
	if p.PurchaseKind == database.PurchaseKindExtraHwid || p.ExtraHwid > 0 && p.Month <= 0 {
		return fmt.Sprintf("💳 %.2f %s · доп. устройства", amt, cur)
	}
	if p.Month > 0 {
		return fmt.Sprintf("💳 %.2f %s · %d мес", amt, cur, p.Month)
	}
	return fmt.Sprintf("💳 %.2f %s", amt, cur)
}

func promoLine(p *database.Purchase) string {
	if p == nil {
		return ""
	}
	hasPromo := p.PromoCodeID != nil && *p.PromoCodeID > 0
	hasDisc := p.DiscountPercentApplied != nil && *p.DiscountPercentApplied > 0
	if !hasPromo && !hasDisc {
		return ""
	}
	var b strings.Builder
	b.WriteString("🏷 промо:")
	if hasPromo {
		b.WriteString(fmt.Sprintf(" #%d", *p.PromoCodeID))
	}
	if hasDisc {
		b.WriteString(fmt.Sprintf(" · −%d%%", *p.DiscountPercentApplied))
	}
	return b.String()
}

func tariffLine(p *database.Purchase) string {
	if p == nil || p.TariffID == nil || *p.TariffID <= 0 {
		return "📦 " + string(p.PurchaseKind) + fmt.Sprintf(" · HWID +%d", p.ExtraHwid)
	}
	return fmt.Sprintf("📦 %s · HWID +%d · тариф #%d", p.PurchaseKind, p.ExtraHwid, *p.TariffID)
}

func durationPaidLine(p *database.Purchase) string {
	if p == nil || p.PaidAt == nil {
		return "⏱ счёт: " + formatClockUTC(p.CreatedAt) + " → оплачен: —"
	}
	d := p.PaidAt.Sub(p.CreatedAt)
	if d < 0 {
		d = 0
	}
	return fmt.Sprintf("⏱ счёт: %s → оплачен: %s · %d с в пути",
		formatClockUTC(p.CreatedAt),
		formatClockUTC(*p.PaidAt),
		int(d.Round(time.Second).Seconds()),
	)
}

func durationCancelLine(p *database.Purchase) string {
	if p == nil {
		return "⏱ счёт: —"
	}
	return "⏱ счёт: " + formatClockUTC(p.CreatedAt) + " (отмена, без оплаты)"
}

func expireChangeLine(before, after *time.Time) string {
	return fmt.Sprintf("📅 подписка до: было %s → стало %s", formatDateDMYUTC(before), formatDateDMYUTC(after))
}

// providerExtrasFromCtx — доп. строки из SuccessfulPayment (Stars) или ответа CryptoPay, если провайдер включён и метаданные переданы в ctx.
func providerExtrasFromCtx(ctx context.Context, p *database.Purchase) string {
	if p == nil {
		return ""
	}
	var b strings.Builder
	switch p.InvoiceType {
	case database.InvoiceTypeTelegram:
		if !config.IsTelegramStarsEnabled() {
			return ""
		}
		m, ok := StarsNotifyMetaFromCtx(ctx)
		if !ok {
			return ""
		}
		b.WriteString("\n\n⭐ Stars (Telegram)\n")
		b.WriteString("tg_charge_id: " + strings.TrimSpace(m.TelegramPaymentChargeID) + "\n")
		b.WriteString("provider_charge_id: " + strings.TrimSpace(m.ProviderPaymentChargeID) + "\n")
		b.WriteString(fmt.Sprintf("successful_payment: %d %s", m.TotalAmount, strings.TrimSpace(m.Currency)))
	case database.InvoiceTypeCrypto:
		if !config.IsCryptoPayEnabled() {
			return ""
		}
		m, ok := CryptoNotifyMetaFromCtx(ctx)
		if !ok {
			return ""
		}
		b.WriteString("\n\n₿ CryptoPay\n")
		if strings.TrimSpace(m.Hash) != "" {
			b.WriteString("hash: " + m.Hash + "\n")
		}
		if strings.TrimSpace(m.Status) != "" {
			b.WriteString("status: " + m.Status + "\n")
		}
		if strings.TrimSpace(m.CurrencyType) != "" || strings.TrimSpace(m.Asset) != "" {
			b.WriteString(fmt.Sprintf("currency: %s · asset: %s\n", m.CurrencyType, m.Asset))
		}
		if strings.TrimSpace(m.PaidAsset) != "" || strings.TrimSpace(m.PaidAmount) != "" {
			b.WriteString(fmt.Sprintf("оплачено: %s %s\n", m.PaidAmount, m.PaidAsset))
		}
		if strings.TrimSpace(m.FeeAmount) != "" {
			b.WriteString("комиссия: " + m.FeeAmount + "\n")
		}
		if strings.TrimSpace(m.PayUrl) != "" {
			b.WriteString("pay_url: " + m.PayUrl + "\n")
		}
		if strings.TrimSpace(m.BotInvoiceUrl) != "" && m.BotInvoiceUrl != m.PayUrl {
			b.WriteString("bot_invoice_url: " + m.BotInvoiceUrl + "\n")
		}
	default:
		return ""
	}
	return b.String()
}

func buildPaidGroupMessage(ctx context.Context, p *database.Purchase, c *database.Customer, cabinet bool, expireBefore, expireAfter *time.Time) string {
	var b strings.Builder
	b.WriteString("✅ Оплата\n\n")
	b.WriteString(fmt.Sprintf("🧾 #%d · paid · %s\n", p.ID, invoiceTypeTitle(p.InvoiceType)))
	b.WriteString(amountPeriodLine(p) + "\n")
	b.WriteString(tariffLine(p) + "\n")
	if p.IsEarlyDowngrade {
		b.WriteString("↘️ ранний даунгрейд: да\n")
	} else {
		b.WriteString("↘️ ранний даунгрейд: нет\n")
	}
	if pl := promoLine(p); pl != "" {
		b.WriteString(pl + "\n")
	}
	b.WriteString("\n")
	b.WriteString(durationPaidLine(p) + "\n")
	b.WriteString(paymentLinkBlock(p) + "\n\n")
	if c != nil {
		b.WriteString(fmt.Sprintf("👤 customer #%d · tg %d · %s (можно скопировать юзернэйм и тг айди)\n",
			c.ID, c.TelegramID, telegramUsernameLine(c)))
	}
	b.WriteString(cabinetWebHint(cabinet, c) + "\n")
	b.WriteString(expireChangeLine(expireBefore, expireAfter))
	b.WriteString(providerExtrasFromCtx(ctx, p))
	return b.String()
}

func buildCancelGroupMessage(p *database.Purchase, c *database.Customer, cabinet bool) string {
	var b strings.Builder
	b.WriteString("❌ Счёт отменён\n\n")
	b.WriteString(fmt.Sprintf("🧾 #%d · cancel · %s\n", p.ID, invoiceTypeTitle(p.InvoiceType)))
	b.WriteString(amountPeriodLine(p) + "\n")
	b.WriteString(tariffLine(p) + "\n")
	if p.IsEarlyDowngrade {
		b.WriteString("↘️ ранний даунгрейд: да\n")
	} else {
		b.WriteString("↘️ ранний даунгрейд: нет\n")
	}
	if pl := promoLine(p); pl != "" {
		b.WriteString(pl + "\n")
	}
	b.WriteString("\n")
	b.WriteString(durationCancelLine(p) + "\n")
	b.WriteString(paymentLinkBlock(p) + "\n\n")
	if c != nil {
		b.WriteString(fmt.Sprintf("👤 customer #%d · tg %d · %s (можно скопировать юзернэйм и тг айди)\n",
			c.ID, c.TelegramID, telegramUsernameLine(c)))
	}
	b.WriteString(cabinetWebHint(cabinet, c))
	return b.String()
}

func (s *PaymentService) sendPaymentsGroupText(ctx context.Context, text string) {
	if s.telegramBot == nil || !config.PaymentsNotifyEnabled() {
		return
	}
	chatID := config.PaymentsNotifyChatID()
	if chatID == 0 {
		slog.Warn("payments notify: PAYMENTS_NOTIFY_CHAT_ID пуст — пропуск отправки")
		return
	}
	params := &bot.SendMessageParams{
		ChatID: chatID,
		Text:   text,
	}
	if tid := config.PaymentsNotifyMessageThreadID(); tid > 0 {
		params.MessageThreadID = tid
	}
	if _, err := s.telegramBot.SendMessage(ctx, params); err != nil {
		slog.Warn("payments notify: не удалось отправить в группу", "error", err)
	}
}

// tryNotifyPurchasePaid — уведомление в группу после успешной оплаты (не влияет на результат покупки).
func (s *PaymentService) tryNotifyPurchasePaid(ctx context.Context, p *database.Purchase, c *database.Customer, expireBefore, expireAfter *time.Time) {
	if p == nil || c == nil || !config.PaymentsNotifySendPaid() {
		return
	}
	cabinet, err := s.purchaseRepository.HasCabinetCheckoutForPurchase(ctx, p.ID)
	if err != nil {
		slog.Warn("payments notify: cabinet_checkout lookup", "error", err)
		cabinet = false
	}
	msg := buildPaidGroupMessage(ctx, p, c, cabinet, expireBefore, expireAfter)
	s.sendPaymentsGroupText(ctx, msg)
}

// tryNotifyPurchaseCancel — уведомление об отмене счёта (YooKassa worker, Tribute cancel и т.д.).
func (s *PaymentService) tryNotifyPurchaseCancel(ctx context.Context, p *database.Purchase, c *database.Customer) {
	if p == nil || !config.PaymentsNotifySendCancel() {
		return
	}
	if c == nil {
		var err error
		c, err = s.customerRepository.FindById(ctx, p.CustomerID)
		if err != nil || c == nil {
			slog.Warn("payments notify cancel: customer not loaded", "customer_id", p.CustomerID, "error", err)
		}
	}
	cabinet, err := s.purchaseRepository.HasCabinetCheckoutForPurchase(ctx, p.ID)
	if err != nil {
		slog.Warn("payments notify cancel: cabinet_checkout lookup", "error", err)
		cabinet = false
	}
	msg := buildCancelGroupMessage(p, c, cabinet)
	s.sendPaymentsGroupText(ctx, msg)
}
