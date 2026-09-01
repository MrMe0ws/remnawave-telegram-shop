package heleket

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"

	"remnawave-tg-shop-bot/internal/database"
)

// amountEpsilon — допуск при сравнении сумм: обе стороны оперируют строками
// с двумя знаками, и точное равенство float здесь неуместно.
const amountEpsilon = 0.01

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

	// locks сериализует обработку одной покупки. В отличие от остальных касс
	// у Heleket вебхук и поллинг работают одновременно, поэтому «прочитали
	// статус → сходили в Remnawave → записали paid» без блокировки давало бы
	// двойное продление подписки.
	locks keyedMutex
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
// Покупка перечитывается из БД под блокировкой, а не берётся снимком от
// вызывающего: поллер составляет список pending заранее, и к моменту обработки
// вебхук уже мог довести ту же покупку до paid.
func (r *Reconciler) Sync(ctx context.Context, purchaseID int64, info *Payment) error {
	if r == nil || info == nil || purchaseID <= 0 {
		return nil
	}
	if r.processor == nil || r.canceller == nil {
		return fmt.Errorf("heleket reconciler is not wired")
	}

	unlock := r.locks.lock(purchaseID)
	defer unlock()

	purchase, err := r.purchaseRepo.FindById(ctx, purchaseID)
	if err != nil {
		return fmt.Errorf("load purchase %d: %w", purchaseID, err)
	}
	if purchase == nil {
		return nil
	}
	if purchase.InvoiceType != database.InvoiceTypeHeleket {
		slog.Warn("heleket: invoice type mismatch", "purchase_id", purchaseID, "invoice_type", purchase.InvoiceType)
		return nil
	}

	status := info.StatusValue()

	switch {
	case info.IsSuccess():
		if mismatch := matchPaymentToPurchase(purchase, info); mismatch != "" {
			// Платёж не тот, за который себя выдаёт. Зачислять нельзя, отменять
			// тоже: деньги могли реально прийти — пусть смотрит человек.
			slog.Error("heleket: paid payment does not match purchase",
				"purchase_id", purchase.ID, "uuid", info.UUID, "reason", mismatch)
			r.notify(ctx, purchase, info.UUID, status, mismatch)
			return nil
		}
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

// matchPaymentToPurchase проверяет, что оплаченный счёт — действительно счёт
// этой покупки. Возвращает описание расхождения или пустую строку.
//
// Связка по одному order_id ненадёжна: мерчант Heleket может быть общим у
// нескольких стендов, а id покупок переиспользуются после восстановления БД
// из бэкапа. Поэтому сверяем ещё uuid, сумму и валюту.
func matchPaymentToPurchase(purchase *database.Purchase, info *Payment) string {
	if purchase.HeleketID != nil {
		stored := strings.TrimSpace(*purchase.HeleketID)
		if stored != "" && !strings.EqualFold(stored, strings.TrimSpace(info.UUID)) {
			return fmt.Sprintf("uuid платежа (%s) не совпадает с сохранённым у покупки (%s)", info.UUID, stored)
		}
	}

	if cur := strings.TrimSpace(info.Currency); cur != "" && strings.TrimSpace(purchase.Currency) != "" {
		if !strings.EqualFold(cur, strings.TrimSpace(purchase.Currency)) {
			return fmt.Sprintf("валюта платежа (%s) не совпадает с валютой покупки (%s)", cur, purchase.Currency)
		}
	}

	if raw := strings.TrimSpace(info.Amount); raw != "" {
		paid, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return fmt.Sprintf("не удалось разобрать сумму платежа (%q)", raw)
		}
		if paid+amountEpsilon < purchase.Amount {
			return fmt.Sprintf("сумма платежа (%.2f) меньше суммы покупки (%.2f)", paid, purchase.Amount)
		}
	}

	return ""
}

func (r *Reconciler) notify(ctx context.Context, purchase *database.Purchase, uuid, status, reason string) {
	if r.notifier == nil {
		return
	}
	r.notifier.NotifyHeleketNeedsAttention(ctx, purchase, uuid, status, reason)
}

// keyedMutex — блокировка по ключу, живущая только пока кто-то её держит.
type keyedMutex struct {
	mu sync.Mutex
	m  map[int64]*keyedMutexEntry
}

type keyedMutexEntry struct {
	mu   sync.Mutex
	refs int
}

func (k *keyedMutex) lock(key int64) func() {
	k.mu.Lock()
	if k.m == nil {
		k.m = make(map[int64]*keyedMutexEntry)
	}
	e, ok := k.m[key]
	if !ok {
		e = &keyedMutexEntry{}
		k.m[key] = e
	}
	e.refs++
	k.mu.Unlock()

	e.mu.Lock()

	return func() {
		e.mu.Unlock()

		k.mu.Lock()
		e.refs--
		if e.refs == 0 {
			delete(k.m, key)
		}
		k.mu.Unlock()
	}
}
