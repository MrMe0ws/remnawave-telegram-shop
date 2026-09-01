package heleket

import (
	"context"
	"fmt"
	"log/slog"

	"remnawave-tg-shop-bot/internal/database"
)

// PurchaseProcessor переводит покупку в оплаченную и активирует подписку.
type PurchaseProcessor interface {
	ProcessPurchaseById(ctx context.Context, purchaseId int64) error
}

// PurchaseCanceller закрывает счёт. Отменяем через него, а не записью статуса
// напрямую: отмену нужно показать пользователю и в группе платежей.
type PurchaseCanceller interface {
	CancelHeleketPayment(purchaseId int64) error
}

// AttentionNotifier зовёт админа на счета, которые нельзя закрыть автоматически.
type AttentionNotifier interface {
	NotifyHeleketNeedsAttention(ctx context.Context, purchase *database.Purchase, heleketUUID, status, reason string)
}

// Reconciler приводит покупку в соответствие с подтверждённым статусом Heleket.
//
// Один и тот же код обслуживает и вебхук, и поллинг: решение о зачислении
// принимается в одном месте, поэтому два пути не могут разойтись в поведении.
type Reconciler struct {
	client       *Client
	purchaseRepo *database.PurchaseRepository
	processor    PurchaseProcessor
	canceller    PurchaseCanceller
	notifier     AttentionNotifier
}

func NewReconciler(
	client *Client,
	purchaseRepo *database.PurchaseRepository,
	processor PurchaseProcessor,
	canceller PurchaseCanceller,
	notifier AttentionNotifier,
) *Reconciler {
	return &Reconciler{
		client:       client,
		purchaseRepo: purchaseRepo,
		processor:    processor,
		canceller:    canceller,
		notifier:     notifier,
	}
}

func (r *Reconciler) Client() *Client {
	return r.client
}

// Confirm запрашивает статус счёта у Heleket. Тело вебхука статусом не считается.
func (r *Reconciler) Confirm(ctx context.Context, uuid, orderID string) (*Payment, error) {
	return r.client.GetPaymentInfo(ctx, uuid, orderID)
}

// Sync применяет подтверждённый статус к покупке.
//
// Метод идемпотентен: повторный вызов с тем же статусом ничего не меняет —
// и вебхук, и поллинг могут принести одно и то же событие несколько раз.
func (r *Reconciler) Sync(ctx context.Context, purchase *database.Purchase, info *Payment) error {
	if purchase == nil || info == nil {
		return nil
	}
	status := info.StatusValue()

	switch {
	case info.IsSuccess():
		switch purchase.Status {
		case database.PurchaseStatusNew, database.PurchaseStatusPending:
			if err := r.processor.ProcessPurchaseById(ctx, purchase.ID); err != nil {
				return fmt.Errorf("process heleket purchase %d: %w", purchase.ID, err)
			}
			slog.Info("heleket: purchase paid", "purchase_id", purchase.ID, "uuid", info.UUID, "status", status)
		case database.PurchaseStatusPaid:
			// Уже зачтено — обычный повтор вебхука или гонка с поллингом.
		default:
			// Счёт отменён/истёк, а оплата всё же пришла. Крипта необратима,
			// поэтому не зачисляем вслепую (рискуем задвоить активацию) —
			// зовём админа разобрать вручную.
			slog.Warn("heleket: paid on non-pending purchase",
				"purchase_id", purchase.ID, "uuid", info.UUID, "purchase_status", purchase.Status)
			r.notify(ctx, purchase, info.UUID, status, "оплата пришла на уже закрытый счёт")
		}

	case info.IsCanceled():
		if purchase.Status == database.PurchaseStatusNew || purchase.Status == database.PurchaseStatusPending {
			if err := r.canceller.CancelHeleketPayment(purchase.ID); err != nil {
				return fmt.Errorf("cancel heleket purchase %d: %w", purchase.ID, err)
			}
			slog.Info("heleket: purchase canceled", "purchase_id", purchase.ID, "uuid", info.UUID, "status", status)
		}

	case info.IsLocked():
		// AML-заморозка на стороне Heleket: ни зачислять, ни отменять нельзя.
		slog.Warn("heleket: payment locked by AML", "purchase_id", purchase.ID, "uuid", info.UUID)
		r.notify(ctx, purchase, info.UUID, status, "платёж заморожен AML-проверкой Heleket")

	default:
		slog.Debug("heleket: status pending", "purchase_id", purchase.ID, "uuid", info.UUID, "status", status)
	}

	return nil
}

func (r *Reconciler) notify(ctx context.Context, purchase *database.Purchase, uuid, status, reason string) {
	if r.notifier == nil {
		return
	}
	r.notifier.NotifyHeleketNeedsAttention(ctx, purchase, uuid, status, reason)
}
