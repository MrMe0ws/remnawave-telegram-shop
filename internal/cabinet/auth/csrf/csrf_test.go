package csrf

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestValidate_success(t *testing.T) {
	tok, err := GenerateToken()
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("POST", "/", nil)
	r.AddCookie(&http.Cookie{Name: CookieName, Value: tok})
	r.Header.Set(HeaderName, tok)
	if err := Validate(r); err != nil {
		t.Fatal(err)
	}
}

func TestValidate_missingCookie(t *testing.T) {
	r := httptest.NewRequest("POST", "/", nil)
	r.Header.Set(HeaderName, "abc")
	if err := Validate(r); err != ErrMissing {
		t.Fatalf("got %v", err)
	}
}

func TestValidate_mismatch(t *testing.T) {
	a, _ := GenerateToken()
	b, _ := GenerateToken()
	r := httptest.NewRequest("POST", "/", nil)
	r.AddCookie(&http.Cookie{Name: CookieName, Value: a})
	r.Header.Set(HeaderName, b)
	if err := Validate(r); err != ErrMismatch {
		t.Fatalf("got %v", err)
	}
}
