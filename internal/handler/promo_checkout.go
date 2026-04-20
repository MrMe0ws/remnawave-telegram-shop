package handler

import (
	"context"
	"log/slog"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/loyalty"
	"remnawave-tg-shop-bot/internal/payment"
)

// checkoutPromoMeta применяет скидки лояльности и pending-промокода к сумме счёта (Tribute исключён, как и промо).
// Мутирует *price — итог к оплате. Возвращает PromoMeta только если участвовал промокод (для записи в purchase).
func (h Handler) checkoutPromoMeta(ctx context.Context, customer *database.Customer, invoiceType database.InvoiceType, price *int) *payment.PromoMeta {
	if customer == nil || price == nil {
		return nil
	}
	if invoiceType == database.InvoiceTypeTribute {
		return nil
	}

	loyaltyPct := 0
	if config.LoyaltyEnabled() && h.loyaltyTierRepository != nil {
		pct, err := h.loyaltyTierRepository.DiscountPercentForXP(ctx, customer.LoyaltyXP)
		if err != nil {
			slog.Error("loyalty discount for checkout", "error", err)
		} else {
			loyaltyPct = pct
		}
	}

	promoPct := 0
	var promoMeta *payment.PromoMeta
	if h.promoService != nil {
		pct, pid, err := h.promoService.PendingDiscountForPayment(ctx, customer.ID)
		if err != nil {
			slog.Error("pending promo for checkout", "error", err)
		} else if pct > 0 && pid != 0 {
			promoPct = pct
			pc := pct
			p := pid
			promoMeta = &payment.PromoMeta{PromoCodeID: &p, DiscountPercentApplied: &pc}
		}
	}

	cap := config.LoyaltyMaxTotalDiscountPercent()
	*price = loyalty.ApplyCombinedPercentDiscount(*price, loyaltyPct, promoPct, cap)
	return promoMeta
}
