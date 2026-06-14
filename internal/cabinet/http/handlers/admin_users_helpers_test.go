package handlers

import (
	"testing"
	"time"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

func TestNormalizeAdminSearchQuery(t *testing.T) {
	if got := normalizeAdminSearchQuery("  @User  "); got != "User" {
		t.Fatalf("got %q", got)
	}
	if got := normalizeAdminSearchQuery(""); got != "" {
		t.Fatalf("empty: got %q", got)
	}
}

func TestIsAdminSearchDigitsOnly(t *testing.T) {
	if !isAdminSearchDigitsOnly("12345") {
		t.Fatal("expected digits only")
	}
	if isAdminSearchDigitsOnly("12a") {
		t.Fatal("expected false for mixed")
	}
}

func TestAdminUsersExtractID(t *testing.T) {
	id, ok := adminUsersExtractID("/cabinet/api/admin/users/42/panel")
	if !ok || id != 42 {
		t.Fatalf("id=%d ok=%v", id, ok)
	}
	_, ok = adminUsersExtractID("/cabinet/api/admin/users/x")
	if ok {
		t.Fatal("expected invalid id")
	}
}

func TestAdminUsersExtractDeviceHwid(t *testing.T) {
	hwid := adminUsersExtractDeviceHwid("/cabinet/api/admin/users/1/devices/abc-123")
	if hwid != "abc-123" {
		t.Fatalf("got %q", hwid)
	}
}

func TestAdminUsersMergeSearchResults_dedup(t *testing.T) {
	ctx := t.Context()
	// nil repo — RW branch skipped; DB rows returned as-is.
	dbRows := []database.Customer{
		{ID: 1, TelegramID: 100},
		{ID: 2, TelegramID: 200},
	}
	merged := adminUsersMergeSearchResults(ctx, nil, dbRows, nil, 10)
	if len(merged) != 2 {
		t.Fatalf("len=%d", len(merged))
	}
}

func TestMapReferralStatsDTO(t *testing.T) {
	dto := mapReferralStatsDTO(database.ReferralStats{
		Total: 10, Paid: 3, Active: 2, Conversion: 30, EarnedTotal: 14, EarnedLastMonth: 1,
	})
	if dto.Total != 10 || dto.Paid != 3 || dto.EarnedTotal != 14 {
		t.Fatalf("dto=%+v", dto)
	}
}

func TestApplyRWStatusToDTO(t *testing.T) {
	dto := adminCustomerDTO{Status: "trial"}
	rw := &remnawave.User{Status: "DISABLED"}
	applyRWStatusToDTO(&dto, rw)
	if dto.Status != "disabled" {
		t.Fatalf("status=%q", dto.Status)
	}
	if dto.RwStatus == nil || *dto.RwStatus != "DISABLED" {
		t.Fatalf("rw_status=%v", dto.RwStatus)
	}
}

func TestDeriveCustomerStatus(t *testing.T) {
	now := time.Now()
	future := now.Add(24 * time.Hour)
	past := now.Add(-24 * time.Hour)
	link := "https://example.com/sub"

	trialCust := &database.Customer{
		ExpireAt:         &future,
		SubscriptionLink: &link,
	}
	paidSubs := 0
	if got := deriveCustomerStatus(trialCust, &paidSubs); got != "trial" {
		t.Fatalf("active trial: got %q", got)
	}
	paidSubs = 1
	if got := deriveCustomerStatus(trialCust, &paidSubs); got != "active" {
		t.Fatalf("active paid: got %q", got)
	}
	expiredTrial := &database.Customer{ExpireAt: &past, SubscriptionLink: &link}
	if got := deriveCustomerStatus(expiredTrial, &paidSubs); got != "expired" {
		t.Fatalf("expired trial: got %q", got)
	}
	if got := deriveCustomerStatus(&database.Customer{}, nil); got != "inactive" {
		t.Fatalf("no subscription: got %q", got)
	}
}
