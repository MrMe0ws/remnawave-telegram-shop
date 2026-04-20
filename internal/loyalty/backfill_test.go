package loyalty

import (
	"testing"

	"remnawave-tg-shop-bot/internal/database"
)

func TestBuildCustomerXPSumsFromPaidPurchases(t *testing.T) {
	p := []database.Purchase{
		{CustomerID: 1, Amount: 100, InvoiceType: database.InvoiceTypeYookasa},
		{CustomerID: 1, Amount: 50.4, InvoiceType: database.InvoiceTypeCrypto},
		{CustomerID: 2, Amount: 0, InvoiceType: database.InvoiceTypeTelegram},
	}
	s := BuildCustomerXPSumsFromPaidPurchases(p)
	if s[1] != 150 {
		t.Fatalf("customer 1: got %d want 150", s[1])
	}
	if s[2] != 0 {
		t.Fatalf("customer 2 stars without rate: got %d", s[2])
	}
}
