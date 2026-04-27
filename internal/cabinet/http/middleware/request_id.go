package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

// RequestIDHeader — имя заголовка для корреляции запросов с логами/метриками.
const RequestIDHeader = "X-Request-Id"

// RequestID гарантирует наличие request id в контексте и в ответном заголовке.
// Если клиент уже прислал X-Request-Id — используется он (для сквозной трассировки),
// иначе генерируется случайный 16-байтный id в hex.
//
// Используется в связке с Logger middleware, чтобы все логи одного запроса имели единый id.
func RequestID() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get(RequestIDHeader)
			if id == "" {
				id = newRequestID()
			}
			w.Header().Set(RequestIDHeader, id)
			ctx := context.WithValue(r.Context(), ctxKeyRequestID, id)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand на Linux/Windows не падает; если таки упал —
		// возвращаем фиксированный маркер, чтобы отличить от обычных id.
		return "reqid-fallback"
	}
	return hex.EncodeToString(b[:])
}
