package heleket

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

const (
	// staleGrace — запас поверх lifetime счёта. Раньше этого срока покупка не
	// закрывается, даже если Heleket отвечает «нет такого платежа»: пользователь
	// может прямо сейчас переводить крипту, а перевод необратим.
	staleGrace = 15 * time.Minute

	// maxPollBatch — потолок на одну порцию. Проход ограничен по времени, и без
	// лимита разросшийся хвост незакрытых счетов съедал бы весь бюджет прохода,
	// а заодно упирался бы в рейт-лимит кассы.
	maxPollBatch = 200
)

// pollStatuses — какие покупки Heleket считаются незакрытыми.
//
// new здесь не для красоты: если создание счёта прошло, а запись heleket_id
// упала, покупка остаётся в new навсегда. По order_id такой счёт всё ещё
// находится у кассы, так что оплату по нему можно подобрать, а безнадёжный —
// закрыть.
var pollStatuses = []database.PurchaseStatus{
	database.PurchaseStatusPending,
	database.PurchaseStatusNew,
}

// PollPending обходит незакрытые счета Heleket и приводит их к текущему статусу.
//
// Работает и когда вебхук настроен: крипта необратима, и пропущенный колбэк
// означал бы, что человек заплатил и ничего не получил. Статус спрашивается тем
// же /v1/payment/info, что и в вебхуке, поэтому решения совпадают.
func (r *Reconciler) PollPending(ctx context.Context) {
	if r == nil || !r.client.IsConfigured() {
		return
	}

	open, err := r.purchaseRepo.FindOpenByInvoiceTypeOrdered(
		ctx,
		database.InvoiceTypeHeleket,
		pollStatuses,
		maxPollBatch,
	)
	if err != nil {
		slog.Error("heleket poll: find open purchases", "error", err)
		return
	}
	if open == nil || len(*open) == 0 {
		return
	}

	for i := range *open {
		if ctx.Err() != nil {
			return
		}
		purchase := (*open)[i]

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
			// Heleket не знает такого счёта. Закрываем только заведомо
			// протухшие: свежий «не найден» бывает и транзиентным, а отменить
			// счёт, по которому идёт перевод, дороже, чем подождать.
			if !r.expired(&purchase) {
				continue
			}
			slog.Warn("heleket poll: payment not found and invoice expired, canceling",
				"purchase_id", purchase.ID, "uuid", uuid, "status", purchase.Status)
			r.cancel(purchase.ID)
			continue
		}

		// Счёт нашёлся, но heleket_id у покупки пуст — значит создание счёта
		// не дописало его в базу. Восстанавливаем связь, иначе покупка так и
		// останется без платежа в админке.
		if uuid == "" && strings.TrimSpace(info.UUID) != "" {
			if err := r.purchaseRepo.UpdateFields(ctx, purchase.ID, map[string]interface{}{
				"heleket_id":  strings.TrimSpace(info.UUID),
				"heleket_url": strings.TrimSpace(info.URL),
			}); err != nil {
				slog.Error("heleket poll: restore heleket_id", "purchase_id", purchase.ID, "error", err)
			} else {
				slog.Info("heleket poll: restored payment link", "purchase_id", purchase.ID, "uuid", info.UUID)
			}
		}

		// Касса всё ещё держит счёт в нетерминальном статусе, хотя тот пережил
		// свой lifetime. Сам он оттуда уже не выйдет, а опрашивать его вечно
		// значит копить запросы к кассе, пока она не начнёт нас ограничивать.
		if !info.IsSuccess() && !info.IsCanceled() && !info.IsLocked() && r.expired(&purchase) {
			slog.Info("heleket poll: invoice outlived its lifetime, canceling",
				"purchase_id", purchase.ID, "uuid", info.UUID, "heleket_status", info.StatusValue())
			r.cancel(purchase.ID)
			continue
		}

		if err := r.Sync(ctx, purchase.ID, info); err != nil {
			slog.Error("heleket poll: sync failed", "purchase_id", purchase.ID, "error", err)
		}
	}
}

func (r *Reconciler) cancel(purchaseID int64) {
	if r.canceller == nil {
		return
	}
	if err := r.canceller.CancelHeleketPayment(purchaseID); err != nil {
		slog.Error("heleket poll: cancel purchase", "purchase_id", purchaseID, "error", err)
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
