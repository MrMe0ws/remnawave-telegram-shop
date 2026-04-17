package payment

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

func TestComputeUpgradeBonusDays_example150vs250(t *testing.T) {
	// 5 календарных дней остатка, пакет 1 мес: 150 vs 250 ₽, DAYS=30 → 5*(150/30)=25₽ → 25/(250/30)=3 дн.
	now := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	exp := now.Add(5 * 24 * time.Hour)
	cust := &database.Customer{ExpireAt: &exp}
	tpOld := &database.TariffPrice{AmountRub: 150}
	tpNew := &database.TariffPrice{AmountRub: 250}
	bonus := ComputeUpgradeBonusDays(cust, tpOld, tpNew, 1, now)
	if bonus != 3 {
		t.Fatalf("bonus days got %d want 3", bonus)
	}
}

func TestComputeUpgradeBonusDays_downgrade250to150(t *testing.T) {
	// 30 дн. остатка премиум 250 vs базовый 150: 30*(250/30) / (150/30) = 50 дн. на базовом
	now := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	exp := now.Add(30 * 24 * time.Hour)
	cust := &database.Customer{ExpireAt: &exp}
	tpOld := &database.TariffPrice{AmountRub: 250}
	tpNew := &database.TariffPrice{AmountRub: 150}
	bonus := ComputeUpgradeBonusDays(cust, tpOld, tpNew, 1, now)
	if bonus != 50 {
		t.Fatalf("bonus days got %d want 50", bonus)
	}
}

func TestUpgradeCalendarDaysRemainingCeil(t *testing.T) {
	now := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	exp := now.Add(5 * 24 * time.Hour)
	cust := &database.Customer{ExpireAt: &exp}
	if n := UpgradeCalendarDaysRemainingCeil(cust, now); n != 5 {
		t.Fatalf("got %d want 5", n)
	}
}
