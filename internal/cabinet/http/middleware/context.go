// Package middleware содержит общие HTTP-мидлвары для web-кабинета:
// request_id, recover, structured logger, CORS, security headers.
//
// Все мидлвары имеют сигнатуру func(http.Handler) http.Handler,
// что позволяет собирать их в цепочку через Chain.
package middleware

import (
	"context"
	"net/http"
)

type ctxKey string

const (
	ctxKeyRequestID ctxKey = "request_id"
	ctxKeyClaims    ctxKey = "auth_claims"
)

// RequestIDFromContext возвращает request id, положенный RequestID middleware,
// или пустую строку, если middleware не был применён.
func RequestIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyRequestID).(string); ok {
		return v
	}
	return ""
}

// SetClaims кладёт jwt.Claims в контекст запроса. Используется RequireAuth.
// Тип аргумента — any, чтобы этот пакет не зависел от auth/jwt.
func SetClaims(ctx context.Context, claims any) context.Context {
	return context.WithValue(ctx, ctxKeyClaims, claims)
}

// ClaimsFromContext достаёт ранее положенные Claims (как any).
// Handler приводит к нужному типу через type assertion.
func ClaimsFromContext(ctx context.Context) any {
	return ctx.Value(ctxKeyClaims)
}

// Chain собирает список middleware в одну обёртку вокруг handler'а.
// Первый middleware в списке — самый внешний (первым получит запрос).
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}
