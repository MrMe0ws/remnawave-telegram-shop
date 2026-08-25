package main

import (
	"errors"
	"testing"
)

// Фоллбэк на прямое соединение допустим только тогда, когда запрос заведомо
// не дошёл до Telegram. Если повторить отправку после ошибки, случившейся уже
// «в полёте», анонс уйдёт в канал дважды — а это видят все подписчики.
func TestIsProxyUnreachable(t *testing.T) {
	cases := []struct {
		name  string
		err   error
		retry bool
	}{
		{
			name:  "http-прокси не поднят",
			err:   errors.New(`Post "https://api.telegram.org/...": proxyconnect tcp: dial tcp 127.0.0.1:7890: connectex: No connection could be made`),
			retry: true,
		},
		{
			name:  "socks5-прокси не отвечает",
			err:   errors.New(`Post "https://api.telegram.org/...": socks connect tcp 127.0.0.1:1080->api.telegram.org:443: dial tcp: i/o timeout`),
			retry: true,
		},
		{
			name:  "опечатка в схеме прокси",
			err:   errors.New(`Post "https://api.telegram.org/...": unsupported protocol scheme "sock5"`),
			retry: true,
		},
		{
			name:  "таймаут запроса — мог долететь, повтор запрещён",
			err:   errors.New(`Post "https://api.telegram.org/...": context deadline exceeded (Client.Timeout exceeded while awaiting headers)`),
			retry: false,
		},
		{
			name:  "разорвано соединение — мог долететь, повтор запрещён",
			err:   errors.New(`Post "https://api.telegram.org/...": EOF`),
			retry: false,
		},
		{
			name:  "DNS не разрешился напрямую — прокси ни при чём",
			err:   errors.New(`Post "https://api.telegram.org/...": dial tcp: lookup api.telegram.org: no such host`),
			retry: false,
		},
		{
			name:  "ошибки нет",
			err:   nil,
			retry: false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isProxyUnreachable(c.err); got != c.retry {
				t.Fatalf("isProxyUnreachable(%v) = %v, ожидалось %v", c.err, got, c.retry)
			}
		})
	}
}
