package jwt

import (
	"testing"
	"time"
)

func TestIssuer_IssueVerify_roundTrip(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef") // 32 bytes
	iss := NewIssuer(secret, 15*time.Minute, "https://cab.example")
	tok, _, err := iss.Issue(7, "u@example.com", true, "en")
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}
	cl, err := iss.Verify(tok)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if cl.AccountID != 7 || !cl.EmailVerified || cl.Email != "u@example.com" || cl.Language != "en" {
		t.Fatalf("claims: %+v", cl)
	}
}

func TestIssuer_Verify_wrongSecret(t *testing.T) {
	iss := NewIssuer([]byte("0123456789abcdef0123456789abcdef"), time.Hour, "https://a")
	tok, _, err := iss.Issue(1, "", false, "ru")
	if err != nil {
		t.Fatal(err)
	}
	other := NewIssuer([]byte("fedcba9876543210fedcba9876543210"), time.Hour, "https://a")
	_, err = other.Verify(tok)
	if err != ErrInvalidToken {
		t.Fatalf("want ErrInvalidToken, got %v", err)
	}
}

func TestIssuer_Verify_wrongIssuer(t *testing.T) {
	issA := NewIssuer([]byte("0123456789abcdef0123456789abcdef"), time.Hour, "https://a")
	tok, _, _ := issA.Issue(1, "", false, "ru")
	issB := NewIssuer([]byte("0123456789abcdef0123456789abcdef"), time.Hour, "https://b")
	_, err := issB.Verify(tok)
	if err != ErrInvalidToken {
		t.Fatalf("want ErrInvalidToken, got %v", err)
	}
}
