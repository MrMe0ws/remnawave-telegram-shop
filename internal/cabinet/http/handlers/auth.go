// Package handlers — HTTP-хендлеры кабинета: auth, me, и т.д.
//
// Все хендлеры возвращают JSON; ошибки маппятся в HTTP-коды по принципу:
//
//	400 — невалидный вход (ErrInvalidInput),
//	401 — неверные учётки / токен (ErrInvalidCredentials, ErrInvalidToken),
//	403 — email не подтверждён, CSRF, rate-limit уже в отдельном middleware,
//	409 — резерв для конфликтов (не используется на MVP),
//	500 — всё остальное (логируется).
package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"remnawave-tg-shop-bot/internal/cabinet/auth/service"
	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	"remnawave-tg-shop-bot/internal/cabinet/http/middleware"
	cabmetrics "remnawave-tg-shop-bot/internal/cabinet/metrics"
	botcfg "remnawave-tg-shop-bot/internal/config"
)

// AuthHandler — группа эндпоинтов /cabinet/api/auth/*.
type AuthHandler struct {
	svc                  *service.Service
	cookieDomain         string
	googleOAuthEnabled   bool
	telegramLoginBotUser string // username без @ для Login Widget; "" — вход через Telegram не настроен
	telegramOIDCEnabled  bool
	telegramWebAuthMode  string
}

// NewAuth — конструктор. googleOAuthEnabled и telegramLoginBotUser — публичные
// подсказки для SPA (см. GET /auth/bootstrap); не секреты.
func NewAuth(
	svc *service.Service,
	cookieDomain string,
	googleOAuthEnabled bool,
	telegramLoginBotUser string,
	telegramOIDCEnabled bool,
	telegramWebAuthMode string,
) *AuthHandler {
	return &AuthHandler{
		svc: svc, cookieDomain: cookieDomain,
		googleOAuthEnabled:   googleOAuthEnabled,
		telegramLoginBotUser: telegramLoginBotUser,
		telegramOIDCEnabled:  telegramOIDCEnabled,
		telegramWebAuthMode:  telegramWebAuthMode,
	}
}

// ============================================================================
// DTOs
// ============================================================================

type registerReq struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	Language     string `json:"language"`
	ReferralCode string `json:"referral_code"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResp struct {
	AccessToken string `json:"access_token"`
	AccessExp   int64  `json:"access_exp"` // unix seconds
	CSRFToken   string `json:"csrf_token"`
}

type forgotReq struct {
	Email string `json:"email"`
}

type resetReq struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

type verifyConfirmReq struct {
	Token string `json:"token"`
}

type messageResp struct {
	Message string `json:"message"`
}

// cabinetSiteLinks собирает публичные URL из env бота (те же, что используются в Telegram-версии).
func cabinetSiteLinks() map[string]string {
	m := make(map[string]string)
	add := func(key, val string) {
		if s := strings.TrimSpace(val); s != "" {
			m[key] = s
		}
	}
	add("bot", botcfg.BotURL())
	add("server_status", botcfg.ServerStatusURL())
	add("support", botcfg.SupportURL())
	add("feedback", botcfg.FeedbackURL())
	add("channel", botcfg.ChannelURL())
	add("tos", botcfg.TosURL())
	add("video_guide", botcfg.VideoGuideURL())
	add("server_selection", botcfg.ServerSelectionURL())
	add("public_offer", botcfg.PublicOfferURL())
	add("privacy_policy", botcfg.PrivacyPolicyURL())
	add("terms_of_service", botcfg.TermsOfServiceURL())
	if len(m) == 0 {
		return nil
	}
	return m
}

// AuthBootstrap — GET /cabinet/api/auth/bootstrap.
// Публичные флаги для страницы логина: какие альтернативные провайдеры доступны.
func (h *AuthHandler) AuthBootstrap(w http.ResponseWriter, r *http.Request) {
	body := map[string]any{
		"google_oauth_enabled": h.googleOAuthEnabled,
		"telegram_oidc_enabled": h.telegramOIDCEnabled,
		"telegram_web_auth_mode": h.telegramWebAuthMode,
	}
	if h.telegramLoginBotUser != "" {
		body["telegram_widget_bot"] = h.telegramLoginBotUser
	}
	if links := cabinetSiteLinks(); len(links) > 0 {
		body["site_links"] = links
	}
	body["brand_name"] = cabcfg.BrandName()
	if u := cabcfg.BrandLogoURLForClient(); u != "" {
		body["brand_logo_url"] = u
	}
	// Не кэшировать у nginx/браузере: после смены env фронт должен сразу увидеть флаги.
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, body)
}

// ============================================================================
// Регистрация
// ============================================================================

// Register — POST /cabinet/api/auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if !decodeJSON(w, r, &req) {
		return
	}
	res, err := h.svc.Register(r.Context(), service.RegisterInput{
		Email:        req.Email,
		Password:     req.Password,
		Language:     req.Language,
		ReferralCode: req.ReferralCode,
		UserAgent:    r.UserAgent(),
		IP:           middleware.ClientIP(r),
	})
	if err != nil {
		cabmetrics.RecordAuth("email_register", "failure")
		writeServiceErr(w, err, "register")
		return
	}
	cabmetrics.RecordAuth("email_register", "success")
	writeJSON(w, http.StatusOK, messageResp{Message: res.Message})
}

// ============================================================================
// Логин / логаут / refresh
// ============================================================================

// Login — POST /cabinet/api/auth/login. В ответе access_token + csrf_token.
// refresh уходит в HttpOnly cookie.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if !decodeJSON(w, r, &req) {
		return
	}
	tp, err := h.svc.Login(r.Context(), service.LoginInput{
		Email:     req.Email,
		Password:  req.Password,
		UserAgent: r.UserAgent(),
		IP:        middleware.ClientIP(r),
	})
	if err != nil {
		cabmetrics.RecordAuth("email_login", "failure")
		writeServiceErr(w, err, "login")
		return
	}
	cabmetrics.RecordAuth("email_login", "success")
	h.setAuthCookies(w, tp)
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: tp.AccessToken,
		AccessExp:   tp.AccessExp.Unix(),
		CSRFToken:   tp.CSRFToken,
	})
}

// Refresh — POST /cabinet/api/auth/refresh. Читает refresh из cookie, ротирует.
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	refresh := service.RefreshCookieFromRequest(r)
	tp, err := h.svc.Refresh(r.Context(), refresh, r.UserAgent(), middleware.ClientIP(r))
	if err != nil {
		// На reuse-detection стираем cookies — иначе SPA будет долбить refresh.
		if errors.Is(err, service.ErrReused) || errors.Is(err, service.ErrInvalidToken) {
			h.clearAuthCookies(w)
		}
		writeServiceErr(w, err, "refresh")
		return
	}
	h.setAuthCookies(w, tp)
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: tp.AccessToken,
		AccessExp:   tp.AccessExp.Unix(),
		CSRFToken:   tp.CSRFToken,
	})
}

// Logout — POST /cabinet/api/auth/logout. Идемпотентно.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	refresh := service.RefreshCookieFromRequest(r)
	if err := h.svc.Logout(r.Context(), refresh); err != nil {
		slog.Warn("logout failed", "error", err)
	}
	h.clearAuthCookies(w)
	writeJSON(w, http.StatusOK, messageResp{Message: "logged out"})
}

// ============================================================================
// Пароль (forgot / reset)
// ============================================================================

// ForgotPassword — POST /cabinet/api/auth/password/forgot. Всегда 200.
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := h.svc.ForgotPassword(r.Context(), req.Email); err != nil {
		slog.Warn("forgot failed", "error", err)
	}
	writeJSON(w, http.StatusOK, messageResp{Message: "if the email is registered, a reset link was sent"})
}

// ResetPassword — POST /cabinet/api/auth/password/reset.
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetReq
	if !decodeJSON(w, r, &req) {
		return
	}
	if err := h.svc.ResetPassword(r.Context(), req.Token, req.NewPassword); err != nil {
		writeServiceErr(w, err, "reset")
		return
	}
	writeJSON(w, http.StatusOK, messageResp{Message: "password updated"})
}

// ============================================================================
// Email verification (подтверждение без авторизации — по токену из письма)
// ============================================================================

// ConfirmEmail — POST /cabinet/api/auth/email/verify/confirm.
func (h *AuthHandler) ConfirmEmail(w http.ResponseWriter, r *http.Request) {
	var req verifyConfirmReq
	if !decodeJSON(w, r, &req) {
		return
	}
	tp, err := h.svc.ConfirmEmail(r.Context(), req.Token, r.UserAgent(), middleware.ClientIP(r))
	if err != nil {
		writeServiceErr(w, err, "confirm_email")
		return
	}
	h.setAuthCookies(w, tp)
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken: tp.AccessToken,
		AccessExp:   tp.AccessExp.Unix(),
		CSRFToken:   tp.CSRFToken,
	})
}

// ============================================================================
// Cookie helpers
// ============================================================================

const refreshCookiePath = "/cabinet/api/auth"

// setAuthCookies — обёртка вокруг пакетного setRefreshCookie (util.go).
func (h *AuthHandler) setAuthCookies(w http.ResponseWriter, tp *service.TokenPair) {
	setRefreshCookie(w, tp, h.cookieDomain, refreshCookiePath)
}

func (h *AuthHandler) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     service.RefreshCookieName,
		Value:    "",
		Path:     refreshCookiePath,
		Domain:   h.cookieDomain,
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	clearCabCsrfCookie(w, h.cookieDomain)
}
