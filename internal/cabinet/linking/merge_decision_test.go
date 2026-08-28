package linking

// Юнит-тесты правил, по которым merge принимает решения. Полная матрица
// сценариев со схемой и панелью — в merge_matrix_integration_test.go.

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

func active(d time.Duration) *time.Time {
	t := time.Now().UTC().Add(d)
	return &t
}

func expired(d time.Duration) *time.Time {
	t := time.Now().UTC().Add(-d)
	return &t
}

func TestMaxInt(t *testing.T) {
	if maxInt(3, 7) != 7 || maxInt(9, 2) != 9 {
		t.Fatal()
	}
}

func TestRealTelegramID(t *testing.T) {
	if got := realTelegramID(0); got != 0 {
		t.Errorf("нулевой id: got %d", got)
	}
	if got := realTelegramID(-5); got != 0 {
		t.Errorf("отрицательный id: got %d", got)
	}
	synthetic := utils.SyntheticTelegramID(42)
	if got := realTelegramID(synthetic); got != 0 {
		t.Errorf("синтетический id %d принят за настоящий Telegram: got %d", synthetic, got)
	}
	if got := realTelegramID(123456789); got != 123456789 {
		t.Errorf("настоящий id отброшен: got %d", got)
	}
}

func TestFirstRealTelegramID(t *testing.T) {
	synthetic := utils.SyntheticTelegramID(7)
	if got := firstRealTelegramID(0, synthetic, 555, 777); got != 555 {
		t.Errorf("got %d, want 555", got)
	}
	if got := firstRealTelegramID(0, synthetic); got != 0 {
		t.Errorf("без настоящего Telegram ожидался 0, got %d", got)
	}
}

func TestSubscriptionChoiceRequired(t *testing.T) {
	cases := []struct {
		name    string
		web, tg *time.Time
		wantAsk bool
	}{
		{"обе активны", active(time.Hour), active(2 * time.Hour), true},
		{"web активна, tg истекла", active(time.Hour), expired(time.Hour), false},
		{"web истекла, tg активна", expired(time.Hour), active(time.Hour), false},
		{"обе истекли", expired(time.Hour), expired(2 * time.Hour), false},
		{"подписок нет", nil, nil, false},
		{"только у web", active(time.Hour), nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			web := &database.Customer{ExpireAt: tc.web}
			tg := &database.Customer{ExpireAt: tc.tg}
			if got := subscriptionChoiceRequired(web, tg); got != tc.wantAsk {
				t.Fatalf("got %v, want %v", got, tc.wantAsk)
			}
		})
	}
}

func TestSubscriptionChoiceRequired_nilSide(t *testing.T) {
	if subscriptionChoiceRequired(nil, &database.Customer{ExpireAt: active(time.Hour)}) {
		t.Fatal("одна сторона отсутствует — выбор невозможен")
	}
}

func TestDefaultKeepSide(t *testing.T) {
	cases := []struct {
		name    string
		web, tg *time.Time
		want    string
	}{
		{"живая web против истёкшей tg", active(time.Hour), expired(time.Hour), keepWeb},
		{"живая tg против истёкшей web", expired(time.Hour), active(time.Hour), keepTg},
		{"только web", active(time.Hour), nil, keepWeb},
		{"только tg", nil, active(time.Hour), keepTg},
		{"обе истекли, web истекла позже", expired(time.Hour), expired(48 * time.Hour), keepWeb},
		{"обе истекли, tg истекла позже", expired(48 * time.Hour), expired(time.Hour), keepTg},
		{"подписок нет", nil, nil, keepTg},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			web := &database.Customer{ExpireAt: tc.web}
			tg := &database.Customer{ExpireAt: tc.tg}
			if got := defaultKeepSide(web, tg); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestSurvivingCustomerRow(t *testing.T) {
	const realTG = int64(900900900)
	web := &database.Customer{ID: 1, TelegramID: utils.SyntheticTelegramID(1)}
	tg := &database.Customer{ID: 2, TelegramID: realTG}

	t.Run("выживает строка с настоящим Telegram", func(t *testing.T) {
		survivor, doomed := survivingCustomerRow(web, tg, realTG)
		if survivor != tg || doomed != web {
			t.Fatalf("survivor=%v doomed=%v", survivor.ID, doomed.ID)
		}
	})

	t.Run("Telegram на web-стороне", func(t *testing.T) {
		w := &database.Customer{ID: 1, TelegramID: realTG}
		g := &database.Customer{ID: 2, TelegramID: 111}
		survivor, doomed := survivingCustomerRow(w, g, realTG)
		if survivor != w || doomed != g {
			t.Fatalf("survivor=%d doomed=%d", survivor.ID, doomed.ID)
		}
	})

	t.Run("без настоящего Telegram выживает текущий аккаунт", func(t *testing.T) {
		g := &database.Customer{ID: 2, TelegramID: utils.SyntheticTelegramID(2)}
		survivor, doomed := survivingCustomerRow(web, g, 0)
		if survivor != web || doomed != g {
			t.Fatalf("survivor=%d doomed=%d", survivor.ID, doomed.ID)
		}
	})
}

func TestAppendUnique(t *testing.T) {
	var got []int64
	got = appendUnique(got, 5)
	got = appendUnique(got, 5)
	got = appendUnique(got, 0)
	got = appendUnique(got, -1)
	got = appendUnique(got, 7)
	if len(got) != 2 || got[0] != 5 || got[1] != 7 {
		t.Fatalf("got %v, want [5 7]", got)
	}
}

func TestPickPanelProfile_resolutionOrder(t *testing.T) {
	users := []remnawave.User{
		{ID: 10, Username: "99_777", SubscriptionUrl: "https://other"},
		{ID: 11, Username: "5_111", SubscriptionUrl: "https://mine"},
		{ID: 12, Username: "unrelated", SubscriptionUrl: "https://x"},
	}

	t.Run("сохранённый id панели важнее эвристик", func(t *testing.T) {
		id := int64(12)
		c := &database.Customer{ID: 5, RemnawaveUserID: &id, SubscriptionLink: strPtrLocal("https://mine")}
		if got := pickPanelProfile(users, c); got == nil || got.ID != 12 {
			t.Fatalf("got %v, want 12", got)
		}
	})

	t.Run("затем ссылка подписки", func(t *testing.T) {
		c := &database.Customer{ID: 42, SubscriptionLink: strPtrLocal("https://mine")}
		if got := pickPanelProfile(users, c); got == nil || got.ID != 11 {
			t.Fatalf("got %v, want 11", got)
		}
	})

	t.Run("затем префикс customer_id", func(t *testing.T) {
		c := &database.Customer{ID: 5}
		if got := pickPanelProfile(users, c); got == nil || got.ID != 11 {
			t.Fatalf("got %v, want 11", got)
		}
	})

	t.Run("ничего не подошло", func(t *testing.T) {
		c := &database.Customer{ID: 12345}
		if got := pickPanelProfile(users, c); got != nil {
			t.Fatalf("got %v, want nil", got)
		}
	})
}

func strPtrLocal(s string) *string { return &s }
