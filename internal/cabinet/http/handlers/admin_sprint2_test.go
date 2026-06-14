package handlers

import "testing"

func TestStarsRubEquiv(t *testing.T) {
	if got := starsRubEquiv(100, 1.5); got != 150 {
		t.Fatalf("got %v want 150", got)
	}
	if starsRubEquiv(10, 0) != 0 {
		t.Fatal("zero rate")
	}
	if starsRubEquiv(0, 2) != 0 {
		t.Fatal("zero stars")
	}
	if starsRubEquiv(-5, 2) != 0 {
		t.Fatal("negative stars")
	}
}

func TestValidatePromoUpdateFields(t *testing.T) {
	if err := validatePromoUpdateFields("subscription_days", map[string]interface{}{"subscription_days": 30}); err != nil {
		t.Fatalf("valid: %v", err)
	}
	if err := validatePromoUpdateFields("subscription_days", map[string]interface{}{"subscription_days": 0}); err == nil {
		t.Fatal("expected invalid subscription_days")
	}
	if err := validatePromoUpdateFields("discount", map[string]interface{}{"discount_percent": 50}); err != nil {
		t.Fatalf("valid discount: %v", err)
	}
	if err := validatePromoUpdateFields("discount", map[string]interface{}{"discount_percent": 101}); err == nil {
		t.Fatal("expected invalid discount_percent")
	}
}
