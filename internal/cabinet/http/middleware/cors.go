package middleware

import (
	"net/http"
	"strings"
)

// CORS реализует строгую проверку origin'а по whitelist'у.
// Использует credentials-cookie, поэтому:
//   - нельзя ставить Allow-Origin: * (браузер отклонит request with credentials);
//   - Vary: Origin обязателен, чтобы CDN/кэши не слипли ответы для разных origin.
//
// Если origin отсутствует (обычный GET /cabinet/* из того же домена) — CORS не применяется,
// запрос просто проходит дальше.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	allow := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" {
			allow[o] = struct{}{}
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}

			normalized := strings.TrimRight(origin, "/")
			if _, ok := allow[normalized]; !ok {
				// Неразрешённый origin: не ставим CORS-заголовки — браузер сам заблокирует.
				// Preflight должен вернуть 403, иначе клиент зависнет в ожидании.
				if r.Method == http.MethodOptions {
					http.Error(w, "origin not allowed", http.StatusForbidden)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization,Content-Type,"+RequestIDHeader+",X-CSRF-Token,Idempotency-Key")
			w.Header().Set("Access-Control-Expose-Headers", RequestIDHeader)
			w.Header().Set("Access-Control-Max-Age", "600")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
