package loyalty

import (
	"testing"

	"remnawave-tg-shop-bot/internal/database"
)

func TestTotalXPForPurchase_RubAmount(t *testing.T) {
	p := &database.Purchase{
		Amount:      99.6,
		InvoiceType: database.InvoiceTypeYookasa,
	}
	got := TotalXPForPurchase(p, XPConfig{RubPerStar: 1.5})
	if got != 100 {
		t.Fatalf("got %d want 100", got)
	}
}

func TestTotalXPForPurchase_StarsWithRate(t *testing.T) {
	p := &database.Purchase{
		Amount:      10,
		InvoiceType: database.InvoiceTypeTelegram,
	}
	got := TotalXPForPurchase(p, XPConfig{RubPerStar: 2})
	if got != 20 {
		t.Fatalf("got %d want 20", got)
	}
}

func TestTotalXPForPurchase_StarsWithoutRateUsesMin(t *testing.T) {
	p := &database.Purchase{
		Amount:      5,
		Month:       3,
		InvoiceType: database.InvoiceTypeTelegram,
	}
	got := TotalXPForPurchase(p, XPConfig{RubPerStar: 0, MinPerPaid: 7})
	if got != 7 {
		t.Fatalf("got %d want 7", got)
	}
}

func TestTotalXPForPurchase_MinPerPaid(t *testing.T) {
	p := &database.Purchase{
		Amount:      0,
		Month:       0,
		InvoiceType: database.InvoiceTypeTelegram,
	}
	got := TotalXPForPurchase(p, XPConfig{RubPerStar: 0, MinPerPaid: 10})
	if got != 10 {
		t.Fatalf("got %d want 10", got)
	}
}

func TestTotalXPForPurchase_ExtraHwidIncludedInAmount(t *testing.T) {
	// ExtraHwid только размечает строку; XP идёт от суммы оплаты, без отдельного бонуса за слоты.
	p := &database.Purchase{
		Amount:      100,
		InvoiceType: database.InvoiceTypeYookasa,
		ExtraHwid:   2,
	}
	got := TotalXPForPurchase(p, XPConfig{})
	if got != 100 {
		t.Fatalf("got %d want 100", got)
	}
}
