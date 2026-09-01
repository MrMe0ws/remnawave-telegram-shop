package heleket

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

// maxCallbackBody — вебхук Heleket маленький; ограничиваем чтение, чтобы
// открытый наружу эндпоинт нельзя было забить гигантским телом.
const maxCallbackBody = 1 << 20

type WebhookHandler struct {
	reconciler   *Reconciler
	purchaseRepo *database.PurchaseRepository
	apiKey       string
}

func NewWebhookHandler(reconciler *Reconciler, purchaseRepo *database.PurchaseRepository, apiKey string) *WebhookHandler {
	return &WebhookHandler{
		reconciler:   reconciler,
		purchaseRepo: purchaseRepo,
		apiKey:       strings.TrimSpace(apiKey),
	}
}

// ServeHTTP принимает колбэк Heleket.
//
// Вебхук здесь — только триггер: статус всегда перезапрашивается у Heleket, а
// тело запроса само по себе ничего не зачисляет. Поэтому расхождение подписи
// логируется, но не отклоняет запрос — подделать зачисление всё равно нельзя.
func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if h.reconciler == nil || !h.reconciler.Client().IsConfigured() {
		http.Error(w, "heleket not configured", http.StatusServiceUnavailable)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	body, err := io.ReadAll(io.LimitReader(r.Body, maxCallbackBody))
	if err != nil {
		slog.Error("heleket webhook: read body error", "error", err)
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	var payload CallbackPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		slog.Error("heleket webhook: unmarshal error", "error", err)
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	uuid := strings.TrimSpace(payload.UUID)
	orderID := strings.TrimSpace(payload.OrderID)
	if uuid == "" && orderID == "" {
		slog.Warn("heleket webhook: no uuid and no order_id")
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	if !VerifyCallback(body, payload.Sign, h.apiKey) {
		slog.Warn("heleket webhook: sign mismatch", "uuid", uuid, "order_id", orderID)
	}

	info, err := h.reconciler.Confirm(ctx, uuid, orderID)
	if err != nil {
		// 503 — Heleket повторит колбэк позже.
		slog.Error("heleket webhook: confirm failed", "error", err, "uuid", uuid, "order_id", orderID)
		http.Error(w, "confirm failed", http.StatusServiceUnavailable)
		return
	}
	if info == nil {
		slog.Warn("heleket webhook: payment not found at heleket", "uuid", uuid, "order_id", orderID)
		w.WriteHeader(http.StatusOK)
		return
	}

	slog.Info("heleket webhook received", "uuid", info.UUID, "order_id", info.OrderID, "status", info.StatusValue())

	purchaseID, ok := purchaseIDFromOrderID(info.OrderID, orderID)
	if !ok {
		slog.Warn("heleket webhook: unparsable order_id", "order_id", info.OrderID, "uuid", info.UUID)
		w.WriteHeader(http.StatusOK)
		return
	}

	purchase, err := h.purchaseRepo.FindById(ctx, purchaseID)
	if err != nil {
		slog.Error("heleket webhook: find purchase failed", "purchase_id", purchaseID, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if purchase == nil {
		// Оплаченный счёт без покупки — просим повторить: строка могла ещё не
		// закоммититься. Неоплаченный просто игнорируем.
		if info.IsSuccess() {
			slog.Error("heleket webhook: paid purchase not found", "purchase_id", purchaseID, "uuid", info.UUID)
			http.Error(w, "purchase not found", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
		return
	}
	if purchase.InvoiceType != database.InvoiceTypeHeleket {
		slog.Warn("heleket webhook: invoice type mismatch",
			"purchase_id", purchaseID, "invoice_type", purchase.InvoiceType)
		w.WriteHeader(http.StatusOK)
		return
	}

	if err := h.reconciler.Sync(ctx, purchase, info); err != nil {
		slog.Error("heleket webhook: sync failed", "purchase_id", purchaseID, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// purchaseIDFromOrderID — order_id счёта это id покупки. Берём подтверждённое
// значение из ответа Heleket, а тело вебхука только как запасное.
func purchaseIDFromOrderID(confirmed, fromCallback string) (int64, bool) {
	for _, raw := range []string{confirmed, fromCallback} {
		id, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
		if err == nil && id > 0 {
			return id, true
		}
	}
	return 0, false
}
