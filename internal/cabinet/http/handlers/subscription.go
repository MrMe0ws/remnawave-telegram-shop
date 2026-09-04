package handlers

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	"remnawave-tg-shop-bot/internal/cabinet/deeplink"
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
		if handleAccountGone(w, err, "subscription.get", claims.AccountID) {
			return
		}
		slog.Error("subscription: get failed", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

// Deeplink — GET /cabinet/api/me/deeplink?app=happ|incy.
//
// Возвращает зашифрованный deep link ({"deeplink": "..."}), которым фронт
// открывает приложение вместо обычного happ://add/ / incy://add/. Стоит за теми
// же барьерами, что и /me/subscription (RequireAuth + RequireVerifiedEmail),
// т.к. фактически выдаёт ссылку подписки (секрет) в обёрнутом виде.
func (h *SubscriptionHandler) Deeplink(w http.ResponseWriter, r *http.Request) {
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

	app := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("app")))
	switch app {
	case "happ":
		if !cabcfg.DeeplinkHappEncryptEnabled() {
			http.Error(w, "deeplink encryption disabled", http.StatusForbidden)
			return
		}
	case "incy":
		if !cabcfg.DeeplinkIncyEncryptEnabled() {
			http.Error(w, "deeplink encryption disabled", http.StatusForbidden)
			return
		}
	default:
		http.Error(w, "unsupported app", http.StatusBadRequest)
		return
	}

	resp, err := h.svc.Get(r.Context(), claims.AccountID)
	if err != nil {
		if handleAccountGone(w, err, "subscription.deeplink", claims.AccountID) {
			return
		}
		slog.Error("deeplink: get subscription failed", "account_id", claims.AccountID, "app", app, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if resp.SubscriptionLink == nil || strings.TrimSpace(*resp.SubscriptionLink) == "" {
		http.Error(w, "no subscription", http.StatusConflict)
		return
	}
	subLink := strings.TrimSpace(*resp.SubscriptionLink)

	var href string
	switch app {
	case "happ":
		href, err = deeplink.EncryptHapp(r.Context(), subLink, cabcfg.DeeplinkHappCryptVersion())
	case "incy":
		href, err = deeplink.EncryptINCY(subLink, cabcfg.BrandName())
	}
	if err != nil {
		// Ссылку подписки не логируем — только факт ошибки.
		slog.Error("deeplink: encrypt failed", "account_id", claims.AccountID, "app", app, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]string{"deeplink": href})
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
		if handleAccountGone(w, err, "subscription.loyalty", claims.AccountID) {
			return
		}
		slog.Error("subscription: loyalty failed", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

// LoyaltyHistory — GET /cabinet/api/me/loyalty/history.
func (h *SubscriptionHandler) LoyaltyHistory(w http.ResponseWriter, r *http.Request) {
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
	limit := 50
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	offset := 0
	if v := strings.TrimSpace(r.URL.Query().Get("offset")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			offset = n
		}
	}
	resp, err := h.svc.LoyaltyHistory(r.Context(), claims.AccountID, limit, offset)
	if err != nil {
		if handleAccountGone(w, err, "subscription.loyalty_history", claims.AccountID) {
			return
		}
		slog.Error("subscription: loyalty history failed", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}
