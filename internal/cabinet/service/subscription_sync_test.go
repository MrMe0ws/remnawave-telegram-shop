package service

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

func TestNeedsWebOnlyRemnawaveSync(t *testing.T) {
	synthetic := utils.SyntheticTelegramID(202)

	tests := []struct {
		name string
		c    *database.Customer
		want bool
	}{
		{"nil", nil, false},
		{"regular tg", &database.Customer{TelegramID: 12345, IsWebOnly: false}, false},
		{"web-only flag", &database.Customer{TelegramID: 12345, IsWebOnly: true}, true},
		{"synthetic id", &database.Customer{TelegramID: synthetic, IsWebOnly: false}, true},
		{"web-only synthetic", &database.Customer{TelegramID: synthetic, IsWebOnly: true}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := needsWebOnlyRemnawaveSync(tt.c); got != tt.want {
				t.Fatalf("needsWebOnlyRemnawaveSync() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSubscriptionTimesAndLinksEqual_webOnlyDesyncScenario(t *testing.T) {
	july := time.Date(2026, 7, 18, 13, 18, 30, 0, time.UTC)
	june := time.Date(2026, 6, 18, 13, 21, 0, 0, time.UTC)
	link := "https://subtest.example/s55Ya74KXc9roULT"

	dbLink := link
	rwLink := link

	if subscriptionTimesAndLinksEqual(&july, &june, &dbLink, &rwLink) {
		t.Fatal("expected DB July vs RW June to be unequal")
	}
	if !subscriptionTimesAndLinksEqual(&june, &june, &dbLink, &rwLink) {
		t.Fatal("expected matching June dates to be equal")
	}
}

func TestSubscriptionTimePtrEqual_truncatesSubSecond(t *testing.T) {
	a := time.Date(2026, 6, 18, 13, 21, 0, 133000000, time.UTC)
	b := time.Date(2026, 6, 18, 13, 21, 0, 500000000, time.UTC)
	if !subscriptionTimePtrEqual(&a, &b) {
		t.Fatal("expected sub-second difference to match after truncate")
	}
}
