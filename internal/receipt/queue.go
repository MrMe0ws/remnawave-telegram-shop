// Package receipt — очередь отправки чеков о доходе в «Мой налог».
//
// Зачем: до появления очереди чек отправлялся синхронно сразу после оплаты, и
// при ошибке терялся навсегда — код писал лог, слал уведомление админу и шёл
// дальше. Многодневный простой ФНС означал ручной ввод каждого дохода.
//
// Схема — outbox: строка чека создаётся в БД ДО HTTP-запроса, поэтому чек
// переживает и сбой сети, и падение процесса между оплатой и отправкой.
package receipt

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/go-telegram/bot"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/moynalog"
	"remnawave-tg-shop-bot/utils"
)

// submitSendTimeout — потолок для фоновой отправки сразу после оплаты.
// Не уложились — чек останется pending и уйдёт через воркер.
const submitSendTimeout = 2 * time.Minute

// incomeSender — часть API «Мой налог», нужная очереди (для подмены в тестах).
type incomeSender interface {
	CreateIncome(ctx context.Context, amount float64, description string, operationTime time.Time) (string, error)
}

// receiptStore — хранилище очереди; интерфейс, чтобы логику повторов можно было
// проверять тестами без живой базы. Реализуется database.MoynalogReceiptRepository.
type receiptStore interface {
	Enqueue(ctx context.Context, purchaseID int64, amount float64, description string, operationTime time.Time) (*database.MoynalogReceipt, error)
	MarkSent(ctx context.Context, id int64, receiptID string) error
	MarkAttemptFailed(ctx context.Context, id int64, sendErr string, nextAttemptAt time.Time) error
	MarkFailed(ctx context.Context, id int64, sendErr string) error
	MarkAlerted(ctx context.Context, id int64) error
	ListDue(ctx context.Context, limit int) ([]database.MoynalogReceipt, error)
	CountPending(ctx context.Context) (int64, error)
}

// Service отправляет чеки и переотправляет застрявшие.
type Service struct {
	repo    receiptStore
	client  incomeSender
	bot     *bot.Bot
	adminID int64
	// enabled и maxAge читаются на каждом обращении, а не запоминаются при
	// старте: обе настройки меняются из админки без рестарта.
	enabled func() bool
	maxAge  func() time.Duration
	// inflight — незавершённые фоновые отправки из Submit.
	inflight sync.WaitGroup
}

// waitInflight дожидается фоновых отправок. Нужен тестам; в бою не вызывается —
// потеря горутины при остановке процесса не теряет чек: строка осталась
// pending и её подхватит воркер после рестарта.
func (s *Service) waitInflight() {
	if s == nil {
		return
	}
	s.inflight.Wait()
}

func NewService(
	repo receiptStore,
	client incomeSender,
	telegramBot *bot.Bot,
	adminID int64,
	enabled func() bool,
	maxAge func() time.Duration,
) *Service {
	return &Service{
		repo: repo, client: client, bot: telegramBot, adminID: adminID,
		enabled: enabled, maxAge: maxAge,
	}
}

// Enabled — очередь собрана и интеграция включена прямо сейчас.
func (s *Service) Enabled() bool {
	if s == nil || s.repo == nil || s.client == nil {
		return false
	}
	return s.enabled == nil || s.enabled()
}

// maxAgeValue — текущий предельный возраст чека.
func (s *Service) maxAgeValue() time.Duration {
	if s.maxAge == nil {
		return 0
	}
	return s.maxAge()
}

// backoffDelay — пауза перед следующей попыткой: 1м, 2м, 4м … с потолком в час.
//
// Потолок важен: простой ФНС измеряется днями, и «N попыток и сдаться» здесь не
// годится — чек должен пережить выходные и дождаться восстановления.
func backoffDelay(attempts int) time.Duration {
	const maxDelay = time.Hour
	if attempts < 0 {
		attempts = 0
	}
	if attempts > 6 {
		return maxDelay
	}
	d := time.Minute << uint(attempts)
	if d > maxDelay {
		return maxDelay
	}
	return d
}

// Submit ставит чек в очередь и сразу пробует отправить.
//
// Ошибки наружу не отдаёт: провал чека не должен ломать обработку оплаты —
// клиент уже заплатил и подписку получил. Незакрытый чек остаётся в очереди.
func (s *Service) Submit(ctx context.Context, purchase *database.Purchase, description string) {
	if !s.Enabled() || purchase == nil {
		return
	}

	// Время операции — момент оплаты. Если по какой-то причине paid_at не
	// проставлен, берём текущее время: лучше приблизительное, чем нулевое.
	operationTime := time.Now()
	if purchase.PaidAt != nil {
		operationTime = *purchase.PaidAt
	}

	row, err := s.repo.Enqueue(ctx, purchase.ID, purchase.Amount, description, operationTime)
	if err != nil {
		slog.Error("moynalog queue: failed to enqueue receipt",
			"error", err, "purchase_id", utils.MaskHalfInt64(purchase.ID))
		return
	}

	// Чек по этой покупке уже закрыт (или снят вручную) — второй раз не шлём.
	if row.Status != database.MoynalogReceiptPending {
		slog.Info("moynalog queue: receipt already settled, skipping",
			"purchase_id", utils.MaskHalfInt64(purchase.ID), "status", row.Status)
		return
	}

	// Строка уже зафиксирована в БД, дальше отправка идёт фоном: клиент не ждёт
	// ответа ФНС (при её недоступности это секунды ретраев внутри клиента).
	// Если отправка не успеет или упадёт — чек остался pending, его подхватит
	// воркер, так что потерять его нельзя.
	//
	// WithoutCancel: ctx запроса отменится, как только обработчик оплаты
	// вернётся, а фоновой отправке нужны значения из него (трассировка и т.п.)
	// без его отмены. Свой таймаут — чтобы горутина не жила вечно.
	queued := *row
	s.inflight.Add(1)
	go func() {
		defer s.inflight.Done()
		bgCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), submitSendTimeout)
		defer cancel()
		s.trySend(bgCtx, queued)
	}()
}

// ProcessDue — тик воркера: отправляет чеки, которым пора на повтор.
func (s *Service) ProcessDue(ctx context.Context) error {
	if !s.Enabled() {
		return nil
	}

	const batchSize = 50
	rows, err := s.repo.ListDue(ctx, batchSize)
	if err != nil {
		return fmt.Errorf("list due receipts: %w", err)
	}
	if len(rows) == 0 {
		return nil
	}

	slog.Info("moynalog queue: processing due receipts", "count", len(rows))
	for i := range rows {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		s.trySend(ctx, rows[i])
	}
	return nil
}

// trySend — одна попытка отправки с обновлением состояния строки.
func (s *Service) trySend(ctx context.Context, r database.MoynalogReceipt) {
	receiptID, err := s.client.CreateIncome(ctx, r.Amount, r.Description, r.OperationTime)
	if err == nil {
		if markErr := s.repo.MarkSent(ctx, r.ID, receiptID); markErr != nil {
			// Чек у ФНС уже создан. Если статус не записался, воркер попробует
			// снова и получится дубль — поэтому логируем как ошибку.
			slog.Error("moynalog queue: receipt accepted but status not saved",
				"error", markErr, "purchase_id", utils.MaskHalfInt64(r.PurchaseID), "receipt_id", receiptID)
			return
		}
		slog.Info("moynalog queue: receipt sent",
			"purchase_id", utils.MaskHalfInt64(r.PurchaseID), "receipt_id", receiptID, "attempts", r.Attempts+1)
		// Сообщаем о восстановлении только если раньше жаловались.
		if r.AlertedAt != nil {
			s.notifyRecovered(ctx, r, receiptID)
		}
		return
	}

	slog.Error("moynalog queue: send failed",
		"error", err, "purchase_id", utils.MaskHalfInt64(r.PurchaseID), "attempts", r.Attempts+1)

	// Предельный возраст исчерпан — снимаем с повторов.
	if age := s.maxAgeValue(); age > 0 && time.Since(r.OperationTime) > age {
		if markErr := s.repo.MarkFailed(ctx, r.ID, err.Error()); markErr != nil {
			slog.Error("moynalog queue: failed to mark receipt failed", "error", markErr, "receipt_row_id", r.ID)
		}
		s.notifyGaveUp(ctx, r, err)
		return
	}

	next := time.Now().Add(backoffDelay(r.Attempts))
	if markErr := s.repo.MarkAttemptFailed(ctx, r.ID, err.Error(), next); markErr != nil {
		slog.Error("moynalog queue: failed to record attempt", "error", markErr, "receipt_row_id", r.ID)
		return
	}

	// Первая неудача по этой строке — сообщаем один раз. Дальше молчим, чтобы
	// многодневный простой не превратился в сотни сообщений.
	if r.AlertedAt == nil {
		s.notifyQueued(ctx, r, err, next)
		if markErr := s.repo.MarkAlerted(ctx, r.ID); markErr != nil {
			slog.Error("moynalog queue: failed to mark alerted", "error", markErr, "receipt_row_id", r.ID)
		}
	}
}

func (s *Service) sendAdminMessage(ctx context.Context, text string) {
	if s.bot == nil || s.adminID == 0 {
		return
	}
	if _, err := s.bot.SendMessage(ctx, &bot.SendMessageParams{ChatID: s.adminID, Text: text}); err != nil {
		slog.Error("moynalog queue: failed to notify admin", "error", err)
	}
}

func (s *Service) notifyQueued(ctx context.Context, r database.MoynalogReceipt, sendErr error, next time.Time) {
	pending, err := s.repo.CountPending(ctx)
	if err != nil {
		pending = 0
	}

	text := fmt.Sprintf(
		"Чек в «Мой налог» не прошёл — поставлен в очередь.\n\n"+
			"Покупка ID: %d\nСумма: %.2f\nОписание: %s\nОплата: %s\n\n"+
			"Следующая попытка: %s\nВсего ждёт отправки: %d\n\n"+
			"Ошибка: %v\n\n"+
			"Повторы идут автоматически, отдельных сообщений по этому чеку больше не будет — "+
			"сообщу, когда пройдёт.",
		r.PurchaseID,
		r.Amount,
		r.Description,
		r.OperationTime.Format("02.01.2006 15:04"),
		next.Format("02.01.2006 15:04"),
		pending,
		sendErr,
	)
	s.sendAdminMessage(ctx, text)
}

func (s *Service) notifyRecovered(ctx context.Context, r database.MoynalogReceipt, receiptID string) {
	text := fmt.Sprintf(
		"Чек в «Мой налог» проведён.\n\n"+
			"Покупка ID: %d\nСумма: %.2f\nОплата: %s\nID чека: %s\nПопыток: %d\n\n"+
			"Доход зарегистрирован датой оплаты.",
		r.PurchaseID,
		r.Amount,
		r.OperationTime.Format("02.01.2006 15:04"),
		receiptID,
		r.Attempts+1,
	)
	s.sendAdminMessage(ctx, text)
}

func (s *Service) notifyGaveUp(ctx context.Context, r database.MoynalogReceipt, sendErr error) {
	text := fmt.Sprintf(
		"Чек в «Мой налог» снят с повторов — истёк предельный срок.\n\n"+
			"Покупка ID: %d\nСумма: %.2f\nОписание: %s\nОплата: %s\n\n"+
			"Последняя ошибка: %v\n\n"+
			"Этот доход нужно внести в приложении вручную.",
		r.PurchaseID,
		r.Amount,
		r.Description,
		r.OperationTime.Format("02.01.2006 15:04"),
		sendErr,
	)
	s.sendAdminMessage(ctx, text)
}

// Компиляционные проверки: боевые реализации удовлетворяют интерфейсам очереди.
var (
	_ incomeSender = (*moynalog.Client)(nil)
	_ receiptStore = (*database.MoynalogReceiptRepository)(nil)
)
