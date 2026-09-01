package heleket

import (
	"net/url"
	"strings"
)

// ResolveWebhook разбирает HELEKET_WEBHOOK_URL на две разные вещи, которые нам
// нужны одновременно: путь для mux и полный адрес для url_callback.
//
// В отличие от остальных касс Heleket не хранит адрес колбэка в личном кабинете
// — он передаётся в каждом запросе на создание счёта, поэтому одного пути мало.
//
// Принимаем оба формата:
//   - полный "https://host/heleket-hook" — путь берём из него, callback как есть;
//   - путь "/heleket-hook" — callback клеим из origin (CABINET_PUBLIC_URL).
//
// Пустой callback не ломает оплату: Heleket просто не позовёт нас обратно, и
// подтверждение останется на поллинге.
func ResolveWebhook(raw, origin string) (muxPath, callbackURL string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", ""
	}

	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Path == "" || parsed.Path == "/" {
			return "", ""
		}
		return parsed.Path, raw
	}

	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	origin = strings.TrimRight(strings.TrimSpace(origin), "/")
	if origin == "" {
		return raw, ""
	}
	return raw, origin + raw
}
