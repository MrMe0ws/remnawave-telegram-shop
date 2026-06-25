package service

import (
	"testing"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

func TestResolveRemnawaveCustomerUser_nilInputs(t *testing.T) {
	c := &database.Customer{TelegramID: 1}
	if _, err := ResolveRemnawaveCustomerUser(t.Context(), nil, c); err == nil {
		t.Fatal("expected error for nil client")
	}
	if _, err := ResolveRemnawaveCustomerUser(t.Context(), &remnawave.Client{}, nil); err == nil {
		t.Fatal("expected error for nil customer")
	}
}

func TestHwidDeviceLimitFromUser(t *testing.T) {
	if got := HwidDeviceLimitFromUser(nil); got != 0 {
		t.Fatalf("nil user: got %d", got)
	}
	lim := 3
	if got := HwidDeviceLimitFromUser(&remnawave.User{HwidDeviceLimit: &lim}); got != 3 {
		t.Fatalf("got %d, want 3", got)
	}
}

func TestResolveRemnawaveCustomerUser_usesWebOnlyPath(t *testing.T) {
	synthetic := utils.SyntheticTelegramID(42)
	c := &database.Customer{ID: 10, TelegramID: synthetic, IsWebOnly: true}
	if !needsWebOnlyRemnawaveSync(c) {
		t.Fatal("expected web-only sync path")
	}
	// Без HTTP к Remnawave — только проверяем, что nil client отлавливается до сети.
	if _, err := ResolveRemnawaveCustomerUser(t.Context(), nil, c); err == nil {
		t.Fatal("expected error")
	}
}
