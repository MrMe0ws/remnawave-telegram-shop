//go:build integration

package database

// Интеграционный тест суммы XP из колеса фортуны для полного пересчёта лояльности.
// Запуск — как partner_integration_test.go.

import (
	"context"
	"testing"
)

// В сумму идут только награды xp и micro; дни, скидки и бесплатные спины — нет.
func TestSumFortuneLoyaltyXPByCustomer(t *testing.T) {
	pool := partnerTestPool(t)
	ctx := context.Background()
	repo := NewCustomerRepository(pool)

	a := makeCustomer(t, pool)
	b := makeCustomer(t, pool)
	spins := []struct {
		cid        int64
		rewardType string
		value      int
	}{
		{a.ID, "xp", 50},
		{a.ID, "micro", 5},
		{a.ID, "days_3", 3},
		{a.ID, "discount_5", 5},
		{a.ID, "free_spin", 1},
		{b.ID, "days_7", 7},
	}
	for _, s := range spins {
		if _, err := pool.Exec(ctx,
			`INSERT INTO fortune_spins (customer_id, reward_type, reward_value) VALUES ($1, $2, $3)`,
			s.cid, s.rewardType, s.value); err != nil {
			t.Fatalf("insert spin: %v", err)
		}
	}

	sums, err := repo.SumFortuneLoyaltyXPByCustomer(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got := sums[a.ID]; got != 55 {
		t.Fatalf("customer a: got %d want 55", got)
	}
	if _, ok := sums[b.ID]; ok {
		t.Fatalf("customer b has no xp spins, got %d", sums[b.ID])
	}
}
