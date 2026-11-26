package remnawave

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
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

// Панель 3.3+ отвергает создание ноды биллинга без name и nextBillingAt (400 Validation failed).
func TestCreateInfraBillingNode_sendsRequiredFields(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"response":{"billingNodes":[]}}`))
	}))
	defer srv.Close()
	c := NewClient(srv.URL, "t", "remote")
	if _, err := c.CreateInfraBillingNode(context.Background(), CreateInfraBillingNodeRequest{ProviderUUID: uuid.New(), NodeUUID: uuid.New()}); err != nil {
		t.Fatal(err)
	}
	if v, ok := got["name"]; !ok || v != nil {
		t.Fatalf("name должен уходить всегда (null допустим), got %v present=%v", v, ok)
	}
	if s, _ := got["nextBillingAt"].(string); s == "" {
		t.Fatalf("nextBillingAt обязателен, got %v", got["nextBillingAt"])
	}
}
