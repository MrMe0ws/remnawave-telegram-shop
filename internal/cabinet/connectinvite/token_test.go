package connectinvite

import (
	"errors"
	"testing"
	"time"
)

var testSecret = []byte("cabinet-test-secret-at-least-32-bytes-long")

func TestIssueParseRoundTrip(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	token, exp, err := Issue(testSecret, 42, DefaultTTL, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if got := exp.Sub(now); got != DefaultTTL {
		t.Fatalf("ttl = %v, want %v", got, DefaultTTL)
	}
	// Длина токена — часть контракта: на ней держится читаемость QR.
	if len(token) != 34 {
		t.Fatalf("token length = %d, want 34 (%q)", len(token), token)
	}

	accountID, err := Parse(testSecret, token, now.Add(time.Hour))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if accountID != 42 {
		t.Fatalf("account id = %d, want 42", accountID)
	}
}

func TestParseExpired(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	token, _, err := Issue(testSecret, 7, time.Hour, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := Parse(testSecret, token, now.Add(time.Hour+time.Second)); !errors.Is(err, ErrExpired) {
		t.Fatalf("err = %v, want ErrExpired", err)
	}
}

func TestParseRejectsForeignSecret(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	token, _, err := Issue(testSecret, 7, DefaultTTL, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := Parse([]byte("another-secret-entirely-different!!"), token, now); !errors.Is(err, ErrSignature) {
		t.Fatalf("err = %v, want ErrSignature", err)
	}
}

// Подмена срока в теле токена не должна проходить проверку подписи — иначе
// приглашение можно было бы продлить себе самому.
func TestParseRejectsTamperedExpiry(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	token, _, err := Issue(testSecret, 7, time.Hour, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	raw, err := encoding.DecodeString(token)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	raw[9]++
	if _, err := Parse(testSecret, encoding.EncodeToString(raw), now); !errors.Is(err, ErrSignature) {
		t.Fatalf("err = %v, want ErrSignature", err)
	}
}

func TestParseMalformed(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	for _, tok := range []string{"", "not-a-token", "AAAA"} {
		if _, err := Parse(testSecret, tok, now); !errors.Is(err, ErrMalformed) {
			t.Fatalf("token %q: err = %v, want ErrMalformed", tok, err)
		}
	}
}
