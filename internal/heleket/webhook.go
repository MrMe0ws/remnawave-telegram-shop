package heleket

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	// maxCallbackBody — тело колбэка Heleket измеряется сотнями байт.
	maxCallbackBody = 16 << 10

	// maxConcurrentCallbacks — сколько колбэков одновременно допускаются к
	// перезапросу статуса. Эндпоинт открыт наружу, а каждый пропущенный запрос
	// стоит нам исходящего вызова к Heleket, так что поток ограничен.
	maxConcurrentCallbacks = 4

	callbackTimeout = 30 * time.Second
)

type WebhookHandler struct {
	reconciler *Reconciler
	apiKey     string
	slots      chan struct{}
}

func NewWebhookHandler(reconciler *Reconciler, apiKey string) *WebhookHandler {
	return &WebhookHandler{
		reconciler: reconciler,
		apiKey:     strings.TrimSpace(apiKey),
		slots:      make(chan struct{}, maxConcurrentCallbacks),
	}
}

// ServeHTTP принимает колбэк Heleket.
//
// Подпись здесь блокирующая. Перезапрос статуса подтверждает, что платёж
// действительно оплачен, но НЕ подтверждает, к какой покупке он относится и не
// отменяет стоимость самого запроса — поэтому неподписанное тело до этой
// проверки не доходит. Если колбэк всё же потеряется, оплату подберёт поллинг.
func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.reconciler == nil || !h.reconciler.Client().IsConfigured() || h.apiKey == "" {
		http.Error(w, "heleket not configured", http.StatusServiceUnavailable)
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxCallbackBody))
	if err != nil {
		slog.Warn("heleket webhook: unreadable body", "error", err)
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	var payload CallbackPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if !VerifyCallback(body, payload.Sign, h.apiKey) {
		slog.Warn("heleket webhook: bad signature", "remote", r.RemoteAddr)
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	uuid := strings.TrimSpace(payload.UUID)
	orderID := strings.TrimSpace(payload.OrderID)
	if uuid == "" && orderID == "" {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	// За подписью — но всё ещё ограничиваем одновременные обращения к Heleket.
	select {
	case h.slots <- struct{}{}:
		defer func() { <-h.slots }()
	default:
		slog.Warn("heleket webhook: busy, letting the poller pick it up")
		http.Error(w, "busy", http.StatusServiceUnavailable)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), callbackTimeout)
	defer cancel()

	info, err := h.reconciler.Confirm(ctx, uuid, orderID)
	if err != nil {
		// 503 — Heleket повторит колбэк позже.
		slog.Error("heleket webhook: confirm failed", "error", err, "uuid", uuid)
		http.Error(w, "confirm failed", http.StatusServiceUnavailable)
		return
	}
	if info == nil {
		slog.Warn("heleket webhook: payment not found at heleket", "uuid", uuid, "order_id", orderID)
		w.WriteHeader(http.StatusOK)
		return
	}

	slog.Info("heleket webhook received", "uuid", info.UUID, "order_id", info.OrderID, "status", info.StatusValue())

	// Только подтверждённый Heleket'ом order_id. Тело запроса как источник id
	// покупки использовать нельзя: оно позволяет привязать чужой оплаченный
	// счёт к любой покупке и получить подписку бесплатно.
	purchaseID, ok := ParseOrderID(h.reconciler.Client().OrderPrefix(), info.OrderID)
	if !ok {
		slog.Warn("heleket webhook: order_id is not ours", "order_id", info.OrderID, "uuid", info.UUID)
		w.WriteHeader(http.StatusOK)
		return
	}

	if err := h.reconciler.Sync(ctx, purchaseID, info); err != nil {
		slog.Error("heleket webhook: sync failed", "purchase_id", purchaseID, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
