package middleware

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// RequireTurnstile проверяет токен Turnstile из заголовка X-Turnstile-Token.
// Если Turnstile выключен в env, middleware становится no-op.
func RequireTurnstile() func(http.Handler) http.Handler {
	client := &http.Client{Timeout: 5 * time.Second}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !cabcfg.TurnstileEnabled() {
				next.ServeHTTP(w, r)
				return
			}
			token := strings.TrimSpace(r.Header.Get("X-Turnstile-Token"))
			if token == "" {
				http.Error(w, "turnstile token required", http.StatusBadRequest)
				return
			}
			if !verifyTurnstile(r, client, token) {
				http.Error(w, "turnstile verification failed", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func verifyTurnstile(r *http.Request, client *http.Client, token string) bool {
	form := url.Values{
		"secret":   {cabcfg.TurnstileSecretKey()},
		"response": {token},
	}
	if ip := ClientIP(r); ip != "" {
		form.Set("remoteip", ip)
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, turnstileVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}
	var payload struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return false
	}
	return payload.Success
}
