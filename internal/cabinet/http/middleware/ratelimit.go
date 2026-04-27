package middleware

import (
	"net"
	"net/http"
	"strings"

	"remnawave-tg-shop-bot/internal/cabinet/auth/ratelimit"
)

// KeyFunc — вычисляет ключ для rate-limiter'а на основе запроса.
// Например: IP + route; IP + email; account_id + route.
type KeyFunc func(r *http.Request) string

// RateLimit — middleware, отдаёт 429 при превышении. Возвращает чистую 429
// без тела — SPA ориентируется на status code.
//
// Если key пустой (например, IP не извлёкся из X-Forwarded-For) — пропускаем,
// не блокируя запрос: лучше ложноотрицательный rate-limit, чем ложноположительный.
func RateLimit(lim *ratelimit.Limiter, keyFn KeyFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			if key != "" && !lim.Allow(key) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, "too many requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP извлекает клиентский IP из запроса с учётом X-Forwarded-For / X-Real-IP.
// Используйте только за доверенным прокси (Nginx/Caddy), иначе клиент сможет
// подделать заголовок и обойти rate-limit. В MVP backend всегда за Nginx.
func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Первая запись — оригинальный клиент (если прокси честный).
		parts := strings.Split(xff, ",")
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
