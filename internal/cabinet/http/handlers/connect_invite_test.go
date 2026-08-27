package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/connectinvite"
)

var inviteTestSecret = []byte("cabinet-test-secret-at-least-32-bytes-long")

// Публичный резолв обязан отбивать негодный токен до похода в БД: svc здесь
// nil, и любой выход за пределы проверки токена уронил бы тест паникой.
func TestResolveRejectsBadTokenBeforeLookup(t *testing.T) {
	expired, _, err := connectinvite.Issue(inviteTestSecret, 1, time.Hour, time.Now().Add(-2*time.Hour))
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	foreign, _, err := connectinvite.Issue([]byte("some-other-secret-entirely-here!!"), 1, time.Hour, time.Now())
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	cases := []struct {
		name      string
		token     string
		status    int
		errorCode string
	}{
		{"empty", "", http.StatusNotFound, "invite_invalid"},
		{"garbage", "not-a-token", http.StatusNotFound, "invite_invalid"},
		{"foreign secret", foreign, http.StatusNotFound, "invite_invalid"},
		{"expired", expired, http.StatusGone, "invite_expired"},
	}

	h := NewConnectInvite(nil, inviteTestSecret)
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.Resolve(rec, httptest.NewRequest(http.MethodGet, "/cabinet/api/public/connect?t="+tc.token, nil))

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if body["error"] != tc.errorCode {
				t.Fatalf("error = %q, want %q", body["error"], tc.errorCode)
			}
		})
	}
}

func TestResolveRejectsNonGet(t *testing.T) {
	h := NewConnectInvite(nil, inviteTestSecret)
	rec := httptest.NewRecorder()
	h.Resolve(rec, httptest.NewRequest(http.MethodPost, "/cabinet/api/public/connect", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
	}
}

// Кэш не должен звать build повторно, пока запись жива: за build стоит сетевой
// вызов crypto.happ.su, а публичную ручку открывает каждый получатель ссылки.
func TestDeeplinkCacheReusesEntry(t *testing.T) {
	c := newDeeplinkCache(time.Minute)
	calls := 0
	build := func() (string, error) {
		calls++
		return "happ://crypt5/xxx", nil
	}

	for range 3 {
		link, err := c.get("happ", "https://example.org/api/sub/token", build)
		if err != nil {
			t.Fatalf("get: %v", err)
		}
		if link != "happ://crypt5/xxx" {
			t.Fatalf("link = %q", link)
		}
	}
	if calls != 1 {
		t.Fatalf("build calls = %d, want 1", calls)
	}

	// Другая подписка — свой ключ, свой вызов.
	if _, err := c.get("happ", "https://example.org/api/sub/other", build); err != nil {
		t.Fatalf("get: %v", err)
	}
	if calls != 2 {
		t.Fatalf("build calls = %d, want 2", calls)
	}
}
