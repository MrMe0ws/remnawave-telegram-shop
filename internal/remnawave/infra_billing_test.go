package remnawave

import (
	"encoding/json"
	"testing"
)

func TestInfraBillingNodesStats_unmarshalFractionalCurrentMonthPayments(t *testing.T) {
	const raw = `{"upcomingNodesCount":2,"currentMonthPayments":3.5,"totalSpent":100.25}`

	var stats InfraBillingNodesStats
	if err := json.Unmarshal([]byte(raw), &stats); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if stats.UpcomingNodesCount != 2 {
		t.Fatalf("upcomingNodesCount = %d, want 2", stats.UpcomingNodesCount)
	}
	if stats.CurrentMonthPayments != 3.5 {
		t.Fatalf("currentMonthPayments = %v, want 3.5", stats.CurrentMonthPayments)
	}
	if stats.TotalSpent != 100.25 {
		t.Fatalf("totalSpent = %v, want 100.25", stats.TotalSpent)
	}
}
