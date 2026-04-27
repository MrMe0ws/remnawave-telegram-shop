package middleware

import "net/http"

// SecurityHeadersAPI — JSON API: без CSP, X-Frame-Options DENY, HSTS только при HTTPS.
func SecurityHeadersAPI() func(http.Handler) http.Handler {
	return securityHeaders(false)
}

// SecurityHeadersSPA — HTML/статика кабинета: CSP с frame-ancestors для Telegram Mini App,
// без X-Frame-Options (уступаем CSP), HSTS только при HTTPS.
func SecurityHeadersSPA() func(http.Handler) http.Handler {
	return securityHeaders(true)
}

func securityHeaders(spa bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()")

			if spa {
				// Mini App / Login Widget: скрипты Telegram + шрифты Google (как на фронте).
				// frame-src + child-src: виджет логина вставляет iframe (oauth.telegram.org).
				// 'unsafe-eval': официальный telegram-widget.js парсит data-onauth через eval/new Function
				// (см. консоль EvalError без этого флага). Ограничение со стороны Telegram, не произвольный eval в нашем бандле.
				h.Set("Content-Security-Policy", stringsJoinCSP(
					"default-src 'self'",
					"script-src 'self' 'unsafe-eval' https://telegram.org https://oauth.telegram.org https://web.telegram.org",
					"connect-src 'self' https://telegram.org https://oauth.telegram.org https://web.telegram.org",
					"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
					"font-src 'self' https://fonts.gstatic.com data:",
					"img-src 'self' data: https: blob:",
					"frame-src 'self' https://oauth.telegram.org https://telegram.org https://web.telegram.org https://t.me",
					"child-src 'self' https://oauth.telegram.org https://telegram.org https://web.telegram.org https://t.me",
					"frame-ancestors 'self' https://web.telegram.org https://telegram.org https://oauth.telegram.org https://t.me",
					"base-uri 'self'",
					"form-action 'self' https://oauth.telegram.org",
				))
			} else {
				h.Set("X-Frame-Options", "DENY")
			}

			if isHTTPSRequest(r) {
				h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}

			next.ServeHTTP(w, r)
		})
	}
}

func stringsJoinCSP(parts ...string) string {
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += "; " + parts[i]
	}
	return out
}

func isHTTPSRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return r.Header.Get("X-Forwarded-Proto") == "https"
}
