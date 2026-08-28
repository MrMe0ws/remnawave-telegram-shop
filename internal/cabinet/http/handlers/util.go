package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/auth/csrf"
	"remnawave-tg-shop-bot/internal/cabinet/auth/service"
	"remnawave-tg-shop-bot/internal/cabinet/bootstrap"
)

// decodeJSON парсит тело запроса в dst. При ошибке пишет 400 и возвращает false.
// Явно ограничиваем размер тела, чтобы нельзя было отправить гигабайт JSON'а.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16) // 64 KiB
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return false
	}
	return true
}

// writeJSON выдаёт JSON-ответ с указанным кодом.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

// writeServiceErr маппит sentinel-ошибки сервиса в HTTP-ответы.
// Любая «странная» ошибка логируется и превращается в 500 без деталей.
func writeServiceErr(w http.ResponseWriter, err error, op string) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, service.ErrInvalidCredentials):
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
	case errors.Is(err, service.ErrInvalidToken):
		http.Error(w, "invalid token", http.StatusUnauthorized)
	case errors.Is(err, service.ErrReused):
		http.Error(w, "refresh reused", http.StatusUnauthorized)
	case errors.Is(err, service.ErrEmailNotVerified):
		http.Error(w, "email not verified", http.StatusForbidden)
	default:
		slog.Error("cabinet handler error", "op", op, "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}

// handleAccountGone отвечает 401, если err — bootstrap.ErrAccountGone: аккаунт
// удалён, а access-JWT ещё не истёк. Возвращает true, если ответ уже записан.
//
// 401 здесь важнее «честного» 404/410: фронт (web/cabinet/src/lib/api.ts) на 401
// пробует refresh, тот падает (cabinet_session удалён каскадом) и вызывает
// logout — вкладка разлогинивается сразу, а не досиживает до конца TTL,
// продолжая дёргать API от имени несуществующего аккаунта.
func handleAccountGone(w http.ResponseWriter, err error, op string, accountID int64) bool {
	if !errors.Is(err, bootstrap.ErrAccountGone) {
		return false
	}
	slog.Info("cabinet: request from deleted account", "op", op, "account_id", accountID)
	w.Header().Set("WWW-Authenticate", `Bearer realm="cabinet", error="invalid_token"`)
	http.Error(w, "unauthorized", http.StatusUnauthorized)
	return true
}

func nowUnix() int64 {
	return time.Now().Unix()
}

// setRefreshCookie ставит refresh (HttpOnly) + csrf (readable) cookies.
// Переиспользуется в auth.go и oauth.go, чтобы cookie-политика была одинаковой.
func setRefreshCookie(w http.ResponseWriter, tp *service.TokenPair, cookieDomain, cookiePath string) {
	http.SetCookie(w, &http.Cookie{
		Name:     service.RefreshCookieName,
		Value:    tp.RefreshToken,
		Path:     cookiePath,
		Domain:   cookieDomain,
		Expires:  tp.RefreshExp,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	csrf.SetCookie(w, tp.CSRFToken, cookieDomain, "/cabinet", int(tp.RefreshExp.Unix()-nowUnix()))
}

// clearCabCsrfCookie удаляет CSRF cookie. Wrapper для csrf.ClearCookie.
func clearCabCsrfCookie(w http.ResponseWriter, cookieDomain string) {
	csrf.ClearCookie(w, cookieDomain, "/cabinet")
}

// clearCabinetSessionCookies — сбрасывает refresh + CSRF (как при logout).
func clearCabinetSessionCookies(w http.ResponseWriter, cookieDomain string) {
	const refreshPath = "/cabinet/api/auth"
	http.SetCookie(w, &http.Cookie{
		Name:     service.RefreshCookieName,
		Value:    "",
		Path:     refreshPath,
		Domain:   cookieDomain,
		MaxAge:   -1,
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	clearCabCsrfCookie(w, cookieDomain)
}
