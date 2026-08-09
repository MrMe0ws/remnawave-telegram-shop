package remnawavewebhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const maxTimestampSkew = 5 * time.Minute

// ValidateSignature проверяет X-Remnawave-Signature = HMAC-SHA256(secret, rawBody) hex.
func ValidateSignature(secret string, body []byte, signature string) bool {
	secret = strings.TrimSpace(secret)
	signature = strings.TrimSpace(signature)
	if secret == "" || signature == "" || len(body) == 0 {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(expected)), []byte(strings.ToLower(signature)))
}

// ValidateTimestamp принимает unix seconds/ms или RFC3339; отклоняет слишком старые/будущие метки.
func ValidateTimestamp(raw string, now time.Time) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false
	}
	var ts time.Time
	if n, err := strconv.ParseInt(raw, 10, 64); err == nil {
		switch {
		case n > 1_000_000_000_000: // ms
			ts = time.UnixMilli(n)
		case n > 0:
			ts = time.Unix(n, 0)
		default:
			return false
		}
	} else if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		ts = t
	} else if t, err := time.Parse(time.RFC3339, raw); err == nil {
		ts = t
	} else {
		return false
	}
	delta := now.Sub(ts)
	if delta < 0 {
		delta = -delta
	}
	return delta <= maxTimestampSkew
}
