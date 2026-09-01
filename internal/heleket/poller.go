package heleket

import (
	"context"
	"log/slog"
	"strconv"
	"strings"

	"remnawave-tg-shop-bot/internal/database"
)

// PollPending обходит pending-счета Heleket и приводит их к текущему статусу.
//
// Работает и когда вебхук настроен: крипта необратима, и пропущенный колбэк
// означал бы, что человек заплатил и ничего не получил. Статус спрашивается тем
// же /v1/payment/info, что и в вебхуке, поэтому решения совпадают.
func (r *Reconciler) PollPending(ctx context.Context) {
	if r == nil || !r.client.IsConfigured() {
		return
	}

	pending, err := r.purchaseRepo.FindByInvoiceTypeAndStatus(
		ctx,
		database.InvoiceTypeHeleket,
		database.PurchaseStatusPending,
	)
	if err != nil {
		slog.Error("heleket poll: find pending", "error", err)
		return
	}
	if pending == nil || len(*pending) == 0 {
		return
	}

	for i := range *pending {
		purchase := (*pending)[i]

		uuid := ""
		if purchase.HeleketID != nil {
			uuid = strings.TrimSpace(*purchase.HeleketID)
		}
		orderID := strconv.FormatInt(purchase.ID, 10)

		info, err := r.client.GetPaymentInfo(ctx, uuid, orderID)
		if err != nil {
			slog.Warn("heleket poll: get payment info", "purchase_id", purchase.ID, "error", err)
			continue
		}
		if info == nil {
			// Heleket не знает такого счёта: создание не дошло до конца.
			// Отменяем, чтобы покупка не висела в pending вечно.
			slog.Warn("heleket poll: payment not found, canceling purchase", "purchase_id", purchase.ID, "uuid", uuid)
			if err := r.canceller.CancelHeleketPayment(purchase.ID); err != nil {
				slog.Error("heleket poll: cancel purchase", "purchase_id", purchase.ID, "error", err)
			}
			continue
		}

		if err := r.Sync(ctx, &purchase, info); err != nil {
			slog.Error("heleket poll: sync failed", "purchase_id", purchase.ID, "error", err)
		}
	}
}
