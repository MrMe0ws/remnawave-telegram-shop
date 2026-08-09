package remnawavewebhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"testing"
	"time"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestValidateSignature(t *testing.T) {
	body := []byte(`{"event":"torrent_blocker.report"}`)
	secret := "testSecret123"
	ok := ValidateSignature(secret, body, sign(secret, body))
	if !ok {
		t.Fatal("expected valid signature")
	}
	if ValidateSignature(secret, body, "deadbeef") {
		t.Fatal("expected invalid signature")
	}
	if ValidateSignature("", body, sign(secret, body)) {
		t.Fatal("empty secret must fail")
	}
}

func TestValidateTimestamp(t *testing.T) {
	now := time.Date(2026, 8, 9, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		raw  string
		want bool
	}{
		{"unix ok", strconv.FormatInt(now.Unix(), 10), true},
		{"unix ms ok", strconv.FormatInt(now.UnixMilli(), 10), true},
		{"rfc3339 ok", now.Format(time.RFC3339), true},
		{"stale", strconv.FormatInt(now.Add(-10*time.Minute).Unix(), 10), false},
		{"empty", "", false},
		{"garbage", "not-a-time", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ValidateTimestamp(tc.raw, now); got != tc.want {
				t.Fatalf("ValidateTimestamp(%q)=%v want %v", tc.raw, got, tc.want)
			}
		})
	}
}
