package avatartoken

import (
	"errors"
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/connectinvite"
)

var secret = []byte("cabinet-secret")

func TestIssueParseRoundTrip(t *testing.T) {
	now := time.Now()
	token, err := Issue(secret, 42, time.Hour, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	got, err := Parse(secret, token, now.Add(time.Minute))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got != 42 {
		t.Fatalf("account id = %d, want 42", got)
	}
}

func TestParseExpired(t *testing.T) {
	now := time.Now()
	token, err := Issue(secret, 42, time.Hour, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := Parse(secret, token, now.Add(2*time.Hour)); !errors.Is(err, ErrExpired) {
		t.Fatalf("err = %v, want ErrExpired", err)
	}
}

func TestParseRejectsForeignSecret(t *testing.T) {
	now := time.Now()
	token, err := Issue(secret, 42, time.Hour, now)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := Parse([]byte("other-secret"), token, now); !errors.Is(err, ErrSignature) {
		t.Fatalf("err = %v, want ErrSignature", err)
	}
}

// Токены приглашения и аватарки совпадают по формату, поэтому важно, что ключи
// разведены контекстом: приглашение не должно открывать чужую картинку.
func TestParseRejectsConnectInviteToken(t *testing.T) {
	now := time.Now()
	invite, _, err := connectinvite.Issue(secret, 42, time.Hour, now)
	if err != nil {
		t.Fatalf("issue invite: %v", err)
	}
	if _, err := Parse(secret, invite, now); !errors.Is(err, ErrSignature) {
		t.Fatalf("err = %v, want ErrSignature", err)
	}
}

func TestParseMalformed(t *testing.T) {
	now := time.Now()
	for _, token := range []string{"", "!!!", "c2hvcnQ"} {
		if _, err := Parse(secret, token, now); !errors.Is(err, ErrMalformed) {
			t.Fatalf("token %q: err = %v, want ErrMalformed", token, err)
		}
	}
}

func TestIssueRejectsBadInput(t *testing.T) {
	now := time.Now()
	if _, err := Issue(nil, 42, time.Hour, now); err == nil {
		t.Fatal("empty secret: want error")
	}
	if _, err := Issue(secret, 0, time.Hour, now); err == nil {
		t.Fatal("zero account id: want error")
	}
}
