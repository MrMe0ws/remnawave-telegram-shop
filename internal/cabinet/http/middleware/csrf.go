package middleware

import (
	"errors"
	"net/http"

	"remnawave-tg-shop-bot/internal/cabinet/auth/csrf"
)

// CSRF — middleware для всех мутирующих методов (POST/PUT/PATCH/DELETE).
// Double-submit cookie: требуем совпадения cookie csrf_token и заголовка
// X-CSRF-Token. GET/HEAD/OPTIONS пропускаются (они не должны менять состояние).
func CSRF() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			if err := csrf.Validate(r); err != nil {
				status := http.StatusForbidden
				msg := "csrf: forbidden"
				switch {
				case errors.Is(err, csrf.ErrMissing):
					msg = "csrf: missing token"
				case errors.Is(err, csrf.ErrMismatch):
					msg = "csrf: token mismatch"
				}
				http.Error(w, msg, status)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
