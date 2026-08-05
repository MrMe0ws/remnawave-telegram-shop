package handler

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

func TestCustomerNeedsLegalGate_NilAccepted(t *testing.T) {
	c := &database.Customer{}
	// Without env URLs LegalDocumentsConfigured() is false → no gate.
	if CustomerNeedsLegalGate(c) {
		t.Fatal("expected no gate when legal URLs are not configured")
	}
	if CustomerNeedsLegalGate(nil) {
		t.Fatal("expected no gate for nil customer when URLs missing")
	}
}

func TestCustomerNeedsLegalGate_WithAcceptedAt(t *testing.T) {
	now := time.Now()
	c := &database.Customer{LegalAcceptedAt: &now}
	if CustomerNeedsLegalGate(c) {
		t.Fatal("accepted customer must not need gate even if URLs were set")
	}
}
