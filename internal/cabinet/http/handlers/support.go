package handlers

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"remnawave-tg-shop-bot/internal/cabinet/http/middleware"
	cabsvc "remnawave-tg-shop-bot/internal/cabinet/service"
	botcfg "remnawave-tg-shop-bot/internal/config"
)

type SupportHandler struct {
	svc *cabsvc.Support
}

func NewSupport(svc *cabsvc.Support) *SupportHandler {
	return &SupportHandler{svc: svc}
}

type supportSendReq struct {
	Text string `json:"text"`
}

func (h *SupportHandler) Summary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if h.svc == nil {
		http.Error(w, "support chat disabled", http.StatusNotFound)
		return
	}
	out, err := h.svc.Summary(r.Context(), claims.AccountID)
	if err != nil {
		writeSupportErr(w, err, "support.summary")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SupportHandler) Conversation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if h.svc == nil {
		http.Error(w, "support chat disabled", http.StatusNotFound)
		return
	}
	out, err := h.svc.Conversation(r.Context(), claims.AccountID)
	if err != nil {
		writeSupportErr(w, err, "support.conversation")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SupportHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if h.svc == nil {
		http.Error(w, "support chat disabled", http.StatusNotFound)
		return
	}
	var in supportSendReq
	if !decodeJSON(w, r, &in) {
		return
	}
	out, err := h.svc.SendMessage(r.Context(), claims.AccountID, in.Text)
	if err != nil {
		writeSupportErr(w, err, "support.send")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SupportHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims := middleware.AuthClaims(r)
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if h.svc == nil {
		http.Error(w, "support chat disabled", http.StatusNotFound)
		return
	}
	if err := h.svc.MarkRead(r.Context(), claims.AccountID); err != nil {
		writeSupportErr(w, err, "support.read")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *SupportHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.svc == nil {
		http.Error(w, "support chat disabled", http.StatusNotFound)
		return
	}
	if !supportWebhookAuthorized(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	var p cabsvc.SupportWebhookPayload
	if err := json.Unmarshal(body, &p); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if err := h.svc.HandleWebhook(r.Context(), p); err != nil {
		writeSupportErr(w, err, "support.webhook")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func supportWebhookAuthorized(r *http.Request) bool {
	secret := botcfg.SupportBridgeSecret()
	if secret == "" {
		return false
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return false
	}
	token := strings.TrimSpace(strings.TrimPrefix(auth, prefix))
	return subtle.ConstantTimeCompare([]byte(token), []byte(secret)) == 1
}

func writeSupportErr(w http.ResponseWriter, err error, op string) {
	switch {
	case errors.Is(err, cabsvc.ErrSupportDisabled):
		http.Error(w, "support chat disabled", http.StatusNotFound)
	case errors.Is(err, cabsvc.ErrSupportInvalidMsg):
		http.Error(w, "invalid message", http.StatusBadRequest)
	case errors.Is(err, cabsvc.ErrSupportBridge):
		slog.Warn("support bridge failed", "op", op, "error", err)
		http.Error(w, "failed to send message", http.StatusBadGateway)
	default:
		writeServiceErr(w, err, op)
	}
}
