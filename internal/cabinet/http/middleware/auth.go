package middleware

import (
	"net/http"
	"strings"

	"remnawave-tg-shop-bot/internal/cabinet/auth/jwt"
)

// RequireAuth — middleware проверки access-JWT в заголовке Authorization.
// Формат: `Authorization: Bearer <token>`. При отсутствии/ошибке — 401.
// Успешно — кладёт *jwt.Claims в контекст (см. ClaimsFromContext).
func RequireAuth(issuer *jwt.Issuer) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			const prefix = "Bearer "
			if !strings.HasPrefix(auth, prefix) {
				w.Header().Set("WWW-Authenticate", `Bearer realm="cabinet"`)
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			token := strings.TrimSpace(auth[len(prefix):])
			claims, err := issuer.Verify(token)
			if err != nil {
				w.Header().Set("WWW-Authenticate", `Bearer realm="cabinet", error="invalid_token"`)
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			ctx := SetClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AuthClaims — удобный хелпер для извлечения claims из контекста с type assertion.
// Возвращает nil, если claims отсутствуют или неверного типа.
func AuthClaims(r *http.Request) *jwt.Claims {
	v := ClaimsFromContext(r.Context())
	if c, ok := v.(*jwt.Claims); ok {
		return c
	}
	return nil
}

// RequireVerifiedEmail — middleware поверх RequireAuth. Отклоняет 403, если
// email в claims не помечен как verified. Используется на /me/subscription и
// /payments/*.
func RequireVerifiedEmail() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := AuthClaims(r)
			if claims == nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			if !claims.EmailVerified {
				http.Error(w, "email not verified", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
