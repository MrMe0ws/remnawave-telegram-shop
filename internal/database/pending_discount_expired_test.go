package database

import (
	"testing"
	"time"
)

func TestPendingDiscountExpired(t *testing.T) {
	now := time.Date(2026, 11, 26, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Hour)
	future := now.Add(time.Hour)

	cases := []struct {
		name string
		pd   *PendingDiscount
		want bool
	}{
		{"нет строки", nil, false},
		{"без срока", &PendingDiscount{}, false},
		{"до первой оплаты без срока", &PendingDiscount{UntilFirstPurchase: true}, false},
		{"срок впереди", &PendingDiscount{ExpiresAt: &future}, false},
		{"срок вышел", &PendingDiscount{ExpiresAt: &past}, true},
		{"до первой оплаты, срок вышел (старая win-back)", &PendingDiscount{UntilFirstPurchase: true, ExpiresAt: &past}, true},
	}
	for _, c := range cases {
		if got := c.pd.Expired(now); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}
