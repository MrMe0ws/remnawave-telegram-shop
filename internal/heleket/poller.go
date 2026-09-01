package heleket

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

// staleGrace — запас поверх lifetime счёта. Раньше этого срока покупка не
// отменяется, даже если Heleket отвечает «нет такого платежа»: пользователь
// может прямо сейчас переводить крипту, а перевод необратим.
const staleGrace = 15 * time.Minute

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
		if ctx.Err() != nil {
			return
		}
		purchase := (*pending)[i]

		uuid := ""
		if purchase.HeleketID != nil {
			uuid = strings.TrimSpace(*purchase.HeleketID)
		}
		orderID := FormatOrderID(r.client.OrderPrefix(), purchase.ID)

		info, err := r.client.GetPaymentInfo(ctx, uuid, orderID)
		if err != nil {
			slog.Warn("heleket poll: get payment info", "purchase_id", purchase.ID, "error", err)
			continue
		}
		if info == nil {
			// Heleket не знает такого счёта. Отменяем только заведомо
			// протухшие: свежий «не найден» бывает и транзиентным, а отменить
			// счёт, по которому идёт перевод, дороже, чем подождать.
			if !r.expired(&purchase) {
				slog.Warn("heleket poll: payment not found yet, leaving pending", "purchase_id", purchase.ID, "uuid", uuid)
				continue
			}
			slog.Warn("heleket poll: payment not found and invoice expired, canceling", "purchase_id", purchase.ID, "uuid", uuid)
			if err := r.canceller.CancelHeleketPayment(purchase.ID); err != nil {
				slog.Error("heleket poll: cancel purchase", "purchase_id", purchase.ID, "error", err)
			}
			continue
		}

		if err := r.Sync(ctx, purchase.ID, info); err != nil {
			slog.Error("heleket poll: sync failed", "purchase_id", purchase.ID, "error", err)
		}
	}
}

// expired — счёт заведомо мёртв: с момента создания прошло больше его времени
// жизни плюс запас.
func (r *Reconciler) expired(purchase *database.Purchase) bool {
	if purchase == nil || purchase.CreatedAt.IsZero() {
		return false
	}
	ttl := time.Duration(r.client.Lifetime())*time.Second + staleGrace
	return time.Since(purchase.CreatedAt) > ttl
}
