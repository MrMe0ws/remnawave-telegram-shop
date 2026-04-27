package linking

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

func TestMaxExpireAt(t *testing.T) {
	a := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	b := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	pa, pb := a, b
	if got := maxExpireAt(&pa, &pb); !got.Equal(pb) {
		t.Fatalf("want later date b, got %v", got)
	}
	if got := maxExpireAt(nil, &pb); !got.Equal(pb) {
		t.Fatal()
	}
	if got := maxExpireAt(&pa, nil); !got.Equal(pa) {
		t.Fatal()
	}
}

func TestMaxInt(t *testing.T) {
	if maxInt(3, 7) != 7 || maxInt(9, 2) != 9 {
		t.Fatal()
	}
}

func ptr(s string) *string { return &s }

func TestMergedSubscriptionLink_noActiveConflict(t *testing.T) {
	t1 := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	web := &database.Customer{ExpireAt: &t1, SubscriptionLink: ptr("https://web")}
	tg := &database.Customer{ExpireAt: &t2, SubscriptionLink: ptr("https://tg")}
	if got := mergedSubscriptionLink(web, tg); *got != "https://web" {
		t.Fatalf("later expire on web → web link, got %v", got)
	}
}

func TestMergedSubscriptionLink_activeConflict_prefersTg(t *testing.T) {
	future := time.Now().UTC().Add(24 * time.Hour)
	web := &database.Customer{ExpireAt: &future, SubscriptionLink: ptr("https://a")}
	tg := &database.Customer{ExpireAt: &future, SubscriptionLink: ptr("https://b")}
	if !activeSubscriptionConflict(web, tg) {
		t.Fatal("expected active conflict")
	}
	if got := mergedSubscriptionLink(web, tg); *got != "https://b" {
		t.Fatalf("conflict: want tg link, got %q", *got)
	}
}

func TestDetectDanger(t *testing.T) {
	future := time.Now().UTC().Add(time.Hour)
	web := &database.Customer{ExpireAt: &future, SubscriptionLink: ptr("x")}
	tg := &database.Customer{ExpireAt: &future, SubscriptionLink: ptr("y")}
	danger, reason := detectDanger(web, tg)
	if !danger || reason == "" {
		t.Fatalf("danger=%v reason=%q", danger, reason)
	}
	// same link → not dangerous
	same := "https://same"
	web2 := &database.Customer{ExpireAt: &future, SubscriptionLink: &same}
	tg2 := &database.Customer{ExpireAt: &future, SubscriptionLink: &same}
	if d, _ := detectDanger(web2, tg2); d {
		t.Fatal("same links should not be dangerous")
	}
}
