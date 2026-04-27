package middleware

import (
	"net/http"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/metrics"
)

// HTTPMetrics записывает histogram cabinet_http_request_duration_seconds.
func HTTPMetrics() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			next.ServeHTTP(w, r)
			path := metrics.NormalizeAPIPath(r.URL.Path)
			metrics.ObserveHTTPDuration(r.Method, path, time.Since(start).Seconds())
		})
	}
}
