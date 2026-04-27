package handlers

import (
	"log/slog"
	"net/http"

	"remnawave-tg-shop-bot/internal/cabinet/http/middleware"
	cabsvc "remnawave-tg-shop-bot/internal/cabinet/service"
)

// SubscriptionHandler — эндпоинт GET /cabinet/api/me/subscription.
//
// Стоит за RequireAuth + RequireVerifiedEmail: подтверждённая почта — наш
// минимальный порог перед выдачей чувствительной информации (subscription_link
// — это по сути секрет, её можно обменять на конфиг VPN).
type SubscriptionHandler struct {
	svc *cabsvc.Subscription
}

// NewSubscription — конструктор.
func NewSubscription(svc *cabsvc.Subscription) *SubscriptionHandler {
	return &SubscriptionHandler{svc: svc}
}

// Get — GET /cabinet/api/me/subscription. Возвращает SubscriptionResponse.
//
// Не кэшируем: данные per-user, бот обновляет customer.expire_at /
// subscription_link сразу после оплаты, UI должен видеть свежую информацию.
func (h *SubscriptionHandler) Get(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	resp, err := h.svc.Get(r.Context(), claims.AccountID)
	if err != nil {
		slog.Error("subscription: get failed", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

// Loyalty — GET /cabinet/api/me/loyalty. Прогресс XP и уровни (как экран лояльности в боте).
func (h *SubscriptionHandler) Loyalty(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	resp, err := h.svc.LoyaltyDashboard(r.Context(), claims.AccountID)
	if err != nil {
		slog.Error("subscription: loyalty failed", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}
