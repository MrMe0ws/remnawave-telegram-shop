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
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		host = strings.TrimSpace(r.RemoteAddr)
	}
	remote := net.ParseIP(host)
	if remote == nil {
		return host
	}

	// Доверяем forwarded-заголовкам только когда запрос пришёл от локального/приватного прокси.
	// Иначе клиент может подделать X-Forwarded-For и обойти rate-limit по IP.
	if isTrustedProxyIP(remote) {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			if ip := net.ParseIP(strings.TrimSpace(parts[0])); ip != nil {
				return ip.String()
			}
		}
		if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
			if ip := net.ParseIP(xri); ip != nil {
				return ip.String()
			}
		}
	}
	return remote.String()
}

func isTrustedProxyIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() {
		return true
	}
	// fc00::/7 (ULA) может не всегда определяться через IsPrivate в старых окружениях.
	return len(ip) == net.IPv6len && (ip[0]&0xfe) == 0xfc
}
