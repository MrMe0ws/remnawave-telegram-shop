package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recover ловит panic в любом последующем handler'е, пишет структурный лог
// и возвращает клиенту 500. Без этого один упавший handler убивает весь HTTP-сервер.
func Recover() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					slog.Error("cabinet: panic recovered",
						"request_id", RequestIDFromContext(r.Context()),
						"method", r.Method,
						"path", r.URL.Path,
						"panic", rec,
						"stack", string(debug.Stack()),
					)
					http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
