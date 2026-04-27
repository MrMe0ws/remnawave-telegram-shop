package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	googleoauth "remnawave-tg-shop-bot/internal/cabinet/auth/oauth"
	"remnawave-tg-shop-bot/internal/cabinet/auth/service"
	"remnawave-tg-shop-bot/internal/cabinet/bootstrap"
	cabmetrics "remnawave-tg-shop-bot/internal/cabinet/metrics"
)

// OAuthHandler — эндпоинты /cabinet/api/auth/google/* и /cabinet/api/auth/telegram.
//
// Google-флоу:
//   GET  /auth/google/start         → редирект на Google
//   GET  /auth/google/callback      → обмен code, login или link-required
//   GET  /auth/google/confirm       → подтверждение привязки по email-токену
//
// Telegram-флоу:
//   POST /auth/telegram             → Widget или MiniApp (поле source)
type OAuthHandler struct {
	svc          *service.Service
	cookieDomain string
}

// NewOAuth — конструктор.
func NewOAuth(svc *service.Service, cookieDomain string) *OAuthHandler {
	return &OAuthHandler{svc: svc, cookieDomain: cookieDomain}
}

// ============================================================================
// Google
// ============================================================================

// GoogleStart — GET /cabinet/api/auth/google/start.
// Генерирует state+PKCE и редиректит браузер на accounts.google.com.
// Опционально: ?ref=ref_<tg> — сохраняется в server-side state до callback (новая регистрация).
func (h *OAuthHandler) GoogleStart(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimSpace(r.URL.Query().Get("ref"))
	redirectURL, err := h.svc.GoogleStart(ref)
	if err != nil {
		if errors.Is(err, service.ErrGoogleDisabled) {
			http.Error(w, "google oauth disabled", http.StatusNotImplemented)
			return
		}
		slog.Error("google start failed", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// GoogleCallback — GET /cabinet/api/auth/google/callback?code=...&state=...
// Обменивает code, создаёт/находит аккаунт и выдаёт сессию.
//
// Возможные ответы:
//   200 OK  — login ok, body содержит access_token + csrf_token
//   202 Accepted  — email совпадает с существующим аккаунтом;
//                   письмо отправлено, body: {"action":"link_required","masked_email":"u***@…"}
//   401/500 — ошибка
func (h *OAuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	if state == "" || code == "" {
		cabmetrics.RecordAuth("google_callback", "client_error")
		http.Error(w, "missing state or code", http.StatusBadRequest)
		return
	}

	result, err := h.svc.GoogleCallback(r.Context(), state, code,
		r.UserAgent(), clientIP(r))
	if err != nil {
		if errors.Is(err, service.ErrGoogleLinkRequired) && result.LinkCtx != nil {
			cabmetrics.RecordAuth("google_callback", "link_required")
			writeJSON(w, http.StatusAccepted, map[string]any{
				"action":       "link_required",
				"masked_email": result.LinkCtx.MaskedEmail,
			})
			return
		}
		if errors.Is(err, service.ErrInvalidToken) {
			cabmetrics.RecordAuth("google_callback", "client_error")
			http.Error(w, "invalid oauth state", http.StatusBadRequest)
			return
		}
		if errors.Is(err, service.ErrInvalidCredentials) {
			cabmetrics.RecordAuth("google_callback", "failure")
			http.Error(w, "account blocked", http.StatusForbidden)
			return
		}
		if errors.Is(err, service.ErrGoogleDisabled) {
			cabmetrics.RecordAuth("google_callback", "client_error")
			http.Error(w, "google oauth disabled", http.StatusNotImplemented)
			return
		}
		slog.Error("google callback failed", "error", err)
		cabmetrics.RecordAuth("google_callback", "server_error")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	cabmetrics.RecordAuth("google_callback", "success")
	setRefreshCookie(w, result.Pair, h.cookieDomain, "/cabinet/api/auth")
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: result.Pair.AccessToken,
		AccessExp:   result.Pair.AccessExp.Unix(),
		CSRFToken:   result.Pair.CSRFToken,
	})
}

// GoogleLinkConfirm — GET /cabinet/api/auth/google/confirm?token=...
// Подтверждает привязку Google к существующему аккаунту по токену из письма.
func (h *OAuthHandler) GoogleLinkConfirm(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		cabmetrics.RecordAuth("google_link_confirm", "client_error")
		http.Error(w, "missing token", http.StatusBadRequest)
		return
	}
	pair, err := h.svc.GoogleLinkConfirm(r.Context(), token, r.UserAgent(), clientIP(r))
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			cabmetrics.RecordAuth("google_link_confirm", "client_error")
			http.Error(w, "invalid or expired token", http.StatusBadRequest)
			return
		}
		if errors.Is(err, service.ErrInvalidCredentials) {
			cabmetrics.RecordAuth("google_link_confirm", "failure")
			http.Error(w, "account blocked", http.StatusForbidden)
			return
		}
		slog.Error("google link confirm failed", "error", err)
		cabmetrics.RecordAuth("google_link_confirm", "server_error")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	cabmetrics.RecordAuth("google_link_confirm", "success")
	setRefreshCookie(w, pair, h.cookieDomain, "/cabinet/api/auth")
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: pair.AccessToken,
		AccessExp:   pair.AccessExp.Unix(),
		CSRFToken:   pair.CSRFToken,
	})
}

// ============================================================================
// Telegram
// ============================================================================

// TelegramOIDCStart — GET /cabinet/api/auth/telegram/start?ref=...
func (h *OAuthHandler) TelegramOIDCStart(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimSpace(r.URL.Query().Get("ref"))
	redirectURL, err := h.svc.TelegramOIDCStart(service.TelegramOIDCStartInput{
		Mode:        googleoauth.TelegramOIDCModeLogin,
		ReferralRaw: ref,
	})
	if err != nil {
		if errors.Is(err, service.ErrTelegramOIDCDisabled) {
			http.Error(w, "telegram oidc disabled", http.StatusNotImplemented)
			return
		}
		slog.Error("telegram oidc start failed", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// TelegramOIDCCallback — GET /cabinet/api/auth/telegram/callback?code=...&state=...
func (h *OAuthHandler) TelegramOIDCCallback(w http.ResponseWriter, r *http.Request) {
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if state == "" || code == "" {
		http.Redirect(w, r, "/cabinet/login?tg_error=missing_code", http.StatusFound)
		return
	}
	res, err := h.svc.TelegramOIDCCallback(r.Context(), state, code, r.UserAgent(), clientIP(r))
	if err != nil {
		slog.Warn("telegram oidc callback failed", "error", err)
		http.Redirect(w, r, "/cabinet/login?tg_error=oauth_failed", http.StatusFound)
		return
	}
	if res.Mode == googleoauth.TelegramOIDCModeLink {
		to := "/cabinet/accounts?tg_linked=1"
		if res.HasMergeCandidate {
			to = "/cabinet/link/merge?auto=1"
		}
		http.Redirect(w, r, to, http.StatusFound)
		return
	}
	if res.Pair == nil {
		http.Redirect(w, r, "/cabinet/login?tg_error=oauth_failed", http.StatusFound)
		return
	}
	setRefreshCookie(w, res.Pair, h.cookieDomain, "/cabinet/api/auth")
	http.Redirect(w, r, "/cabinet/dashboard", http.StatusFound)
}

// telegramLoginReq — тело POST /cabinet/api/auth/telegram.
// Поля зависят от source.
type telegramLoginReq struct {
	Source string `json:"source"` // "widget" | "miniapp"

	// Widget-поля (source=widget).
	ID        int64  `json:"id,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
	PhotoURL  string `json:"photo_url,omitempty"`
	AuthDate  int64  `json:"auth_date,omitempty"`
	Hash      string `json:"hash,omitempty"`

	// MiniApp-поля (source=miniapp).
	InitData string `json:"init_data,omitempty"`

	// Реферал (как у POST /auth/register): ref_<telegram_id> реферера.
	ReferralCode string `json:"referral_code,omitempty"`
}

// TelegramLogin — POST /cabinet/api/auth/telegram.
// Принимает source=widget (поля Widget) или source=miniapp (init_data).
// Возвращает токен-пару аналогично /auth/login.
func (h *OAuthHandler) TelegramLogin(w http.ResponseWriter, r *http.Request) {
	var req telegramLoginReq
	if !decodeJSON(w, r, &req) {
		return
	}

	var pair *service.TokenPair
	var err error

	ua := r.UserAgent()
	ip := clientIP(r)

	switch req.Source {
	case "widget":
		pair, err = h.svc.TelegramLoginWidget(r.Context(), service.TelegramWidgetInput{
			ID:           req.ID,
			FirstName:    req.FirstName,
			LastName:     req.LastName,
			Username:     req.Username,
			PhotoURL:     req.PhotoURL,
			AuthDate:     req.AuthDate,
			Hash:         req.Hash,
			ReferralCode: req.ReferralCode,
			UserAgent:    ua,
			IP:           ip,
		})
	case "miniapp":
		pair, err = h.svc.TelegramLoginMiniApp(r.Context(), service.TelegramMiniAppInput{
			InitData:     req.InitData,
			ReferralCode: req.ReferralCode,
			UserAgent:    ua,
			IP:           ip,
		})
	default:
		cabmetrics.RecordAuth("telegram_login", "client_error")
		http.Error(w, "unknown source (use 'widget' or 'miniapp')", http.StatusBadRequest)
		return
	}

	if err != nil {
		if errors.Is(err, service.ErrTelegramDisabled) {
			cabmetrics.RecordAuth("telegram_login", "client_error")
			http.Error(w, "telegram login disabled", http.StatusNotImplemented)
			return
		}
		if errors.Is(err, service.ErrInvalidCredentials) {
			slog.Warn("telegram login verification failed",
				"source", req.Source,
				"init_data_len", len(req.InitData),
				"user_id", req.ID,
				"ua", ua,
				"ip", ip,
			)
			cabmetrics.RecordAuth("telegram_login", "failure")
			http.Error(w, "telegram verification failed", http.StatusUnauthorized)
			return
		}
		if errors.Is(err, service.ErrInvalidToken) {
			cabmetrics.RecordAuth("telegram_login", "client_error")
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if errors.Is(err, service.ErrInvalidInput) {
			cabmetrics.RecordAuth("telegram_login", "client_error")
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if errors.Is(err, bootstrap.ErrTelegramCustomerLinkedElsewhere) {
			cabmetrics.RecordAuth("telegram_login", "client_error")
			http.Error(w, "this Telegram account is already linked to another cabinet account", http.StatusConflict)
			return
		}
		slog.Error("telegram login failed", "source", req.Source, "error", err)
		cabmetrics.RecordAuth("telegram_login", "server_error")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	method := "telegram_widget"
	if req.Source == "miniapp" {
		method = "telegram_miniapp"
	}
	cabmetrics.RecordAuth(method, "success")
	setRefreshCookie(w, pair, h.cookieDomain, "/cabinet/api/auth")
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: pair.AccessToken,
		AccessExp:   pair.AccessExp.Unix(),
		CSRFToken:   pair.CSRFToken,
	})
}

// ============================================================================
// Helpers
// ============================================================================

// clientIP — быстрый хелпер для X-Forwarded-For / RemoteAddr.
// Не pretend to be production-grade (нет trust-proxy list), но для rate-limit
// достаточно.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	return r.RemoteAddr
}
