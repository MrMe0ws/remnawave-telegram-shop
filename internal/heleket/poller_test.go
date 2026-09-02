package heleket

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

func TestReconcilerExpired(t *testing.T) {
	const lifetime = 3600
	r := &Reconciler{client: NewClient("m", "k", "", "RUB", "shop", lifetime)}
	ttl := time.Duration(lifetime)*time.Second + staleGrace

	cases := []struct {
		name string
		age  time.Duration
		want bool
	}{
		{name: "только что создан", age: 0, want: false},
		{name: "внутри lifetime", age: 30 * time.Minute, want: false},
		{name: "lifetime вышел, но запас ещё нет", age: time.Hour + 5*time.Minute, want: false},
		{name: "lifetime и запас вышли", age: ttl + time.Minute, want: true},
		{name: "древний", age: 30 * 24 * time.Hour, want: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := &database.Purchase{CreatedAt: time.Now().Add(-tc.age)}
			if got := r.expired(p); got != tc.want {
				t.Fatalf("expired(возраст %s) = %v, ожидалось %v", tc.age, got, tc.want)
			}
		})
	}

	t.Run("без даты создания не считаем протухшим", func(t *testing.T) {
		if r.expired(&database.Purchase{}) {
			t.Fatal("покупка без created_at не должна закрываться")
		}
		if r.expired(nil) {
			t.Fatal("nil не должен считаться протухшим")
		}
	})
}

// TestPollStatusesIncludeNew фиксирует, что поллер подбирает и покупки,
// застрявшие в new: у них счёт в кассе есть, а heleket_id в базу не дописался.
func TestPollStatusesIncludeNew(t *testing.T) {
	seen := map[database.PurchaseStatus]bool{}
	for _, s := range pollStatuses {
		seen[s] = true
	}
	if !seen[database.PurchaseStatusNew] || !seen[database.PurchaseStatusPending] {
		t.Fatalf("поллер должен смотреть и new, и pending, сейчас: %v", pollStatuses)
	}
	if seen[database.PurchaseStatusPaid] || seen[database.PurchaseStatusCancel] {
		t.Fatalf("закрытые покупки опрашивать не нужно: %v", pollStatuses)
	}
}
