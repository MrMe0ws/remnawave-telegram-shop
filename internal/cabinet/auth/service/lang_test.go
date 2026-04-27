package service

import "testing"

func TestNormalizeLang(t *testing.T) {
	if g := normalizeLang(" EN ", "ru"); g != "en" {
		t.Fatalf("got %q", g)
	}
	if g := normalizeLang("ru", "en"); g != "ru" {
		t.Fatal()
	}
	if g := normalizeLang("", "en"); g != "en" {
		t.Fatalf("empty → fallback, got %q", g)
	}
	if g := normalizeLang("xx", ""); g != "ru" {
		t.Fatalf("unknown empty fallback → ru, got %q", g)
	}
	if g := normalizeLang("  FR ", "en"); g != "en" {
		t.Fatalf("unknown with fallback, got %q", g)
	}
}
