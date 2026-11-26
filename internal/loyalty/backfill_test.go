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

// Пересчёт не должен стирать XP из колеса фортуны: они прибавляются к сумме за оплаты,
// в том числе клиенту без единой оплаты.
func TestBuildCustomerXPSums_AddsFortuneXP(t *testing.T) {
	p := []database.Purchase{
		{CustomerID: 1, Amount: 100, InvoiceType: database.InvoiceTypeYookasa},
		{CustomerID: 2, Amount: 40, InvoiceType: database.InvoiceTypeCrypto},
	}
	fortune := map[int64]int64{
		1: 25, // оплаты + колесо
		3: 10, // только колесо
		4: 0,  // пустые и отрицательные значения не трогают итог
		5: -7,
	}
	s := BuildCustomerXPSums(p, fortune)
	want := map[int64]int64{1: 125, 2: 40, 3: 10}
	if len(s) != len(want) {
		t.Fatalf("got %v, want %v", s, want)
	}
	for cid, xp := range want {
		if s[cid] != xp {
			t.Fatalf("customer %d: got %d want %d", cid, s[cid], xp)
		}
	}
}

func TestBuildCustomerXPSums_NilFortune(t *testing.T) {
	p := []database.Purchase{{CustomerID: 1, Amount: 100, InvoiceType: database.InvoiceTypeYookasa}}
	if s := BuildCustomerXPSums(p, nil); s[1] != 100 || len(s) != 1 {
		t.Fatalf("got %v", s)
	}
}
