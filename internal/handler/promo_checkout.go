package handler

import (
	"context"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/payment"
	"remnawave-tg-shop-bot/internal/promo"
)

// checkoutPromoMeta applies pending percent discount to price (Tribute excluded). Returns meta for purchase row or nil.
func (h Handler) checkoutPromoMeta(ctx context.Context, customer *database.Customer, invoiceType database.InvoiceType, price *int) *payment.PromoMeta {
	if h.promoService == nil || customer == nil || invoiceType == database.InvoiceTypeTribute {
		return nil
	}
	pct, pid, err := h.promoService.PendingDiscountForPayment(ctx, customer.ID)
	if err != nil || pct <= 0 || pid == 0 {
		return nil
	}
	*price = promo.ApplyPercentDiscountInt(*price, pct)
	pc := pct
	p := pid
	return &payment.PromoMeta{PromoCodeID: &p, DiscountPercentApplied: &pc}
}
