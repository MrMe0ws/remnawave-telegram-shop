package handler

import "testing"

func TestPctStr(t *testing.T) {
	tests := []struct {
		num, den int64
		want     string
	}{
		{135, 1016, "13.3"},
		{3, 28, "10.7"},
		{0, 100, "0.0"},
		{5, 0, "0.0"},
	}
	for _, tc := range tests {
		if got := pctStr(tc.num, tc.den); got != tc.want {
			t.Fatalf("pctStr(%d, %d) = %q, want %q", tc.num, tc.den, got, tc.want)
		}
	}
}

func TestGrowthPct(t *testing.T) {
	tests := []struct {
		cur, prev int64
		want      string
	}{
		{29, 95, "-69.5"},
		{0, 6, "-100.0"},
		{6, 0, "100.0"},
		{0, 0, "0.0"},
		{10, 10, "0.0"},
		{15, 10, "50.0"},
	}
	for _, tc := range tests {
		if got := growthPct(tc.cur, tc.prev); got != tc.want {
			t.Fatalf("growthPct(%d, %d) = %q, want %q", tc.cur, tc.prev, got, tc.want)
		}
	}
}

func TestPaidShareAmongActiveVPN(t *testing.T) {
	// Как в AdminStatsSubsHandler: paid / (trial + paid) * 100
	paid, trial := int64(3), int64(0)
	den := trial + paid
	got := pctStr(paid, den)
	if got != "100.0" {
		t.Fatalf("paid share with 0 trials = %q, want 100.0", got)
	}

	paid, trial = 2, 1
	den = trial + paid
	got = pctStr(paid, den)
	if got != "66.7" {
		t.Fatalf("paid share 2/3 = %q, want 66.7", got)
	}
}
