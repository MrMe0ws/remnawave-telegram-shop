package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"remnawave-tg-shop-bot/internal/cabinet/http/middleware"
	cabsvc "remnawave-tg-shop-bot/internal/cabinet/service"
)

// FortuneHandler — /cabinet/api/fortune/*.
type FortuneHandler struct {
	svc *cabsvc.FortuneService
}

func NewFortune(svc *cabsvc.FortuneService) *FortuneHandler {
	return &FortuneHandler{svc: svc}
}

// Status — GET /cabinet/api/fortune/status.
func (h *FortuneHandler) Status(w http.ResponseWriter, r *http.Request) {
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
	resp, err := h.svc.Status(r.Context(), claims.AccountID)
	if err != nil {
		slog.Error("fortune status", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

// RecentWins — GET /cabinet/api/fortune/recent-wins.
func (h *FortuneHandler) RecentWins(w http.ResponseWriter, r *http.Request) {
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
	resp, err := h.svc.RecentWinsFeed(r.Context())
	if err != nil {
		slog.Error("fortune recent wins", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, resp)
}

// Spin — POST /cabinet/api/fortune/spin.
func (h *FortuneHandler) Spin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	resp, err := h.svc.Spin(r.Context(), claims.AccountID)
	if err != nil {
		if code, msg, ok := cabsvc.FortuneClientErrorCode(err); ok {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": msg, "code": code})
			return
		}
		slog.Error("fortune spin", "account_id", claims.AccountID, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
