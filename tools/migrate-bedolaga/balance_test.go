package main

import (
	"testing"
	"time"
)

func TestBalanceDays(t *testing.T) {
	tests := []struct {
		name    string
		kopeks  int64
		price1m int
		want    int
	}{
		{"zero balance", 0, 100, 0},
		{"premium 100rub / 100rub", 10000, 100, 30},
		{"basic 100rub / 50rub", 10000, 50, 60},
		{"tiny balance rounds up", 100, 1000, 1}, // 1 rub / 1000 → ceil(0.03)=1
		{"bad price still min 1", 500, 0, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := BalanceDays(tt.kopeks, tt.price1m); got != tt.want {
				t.Fatalf("BalanceDays(%d,%d)=%d want %d", tt.kopeks, tt.price1m, got, tt.want)
			}
		})
	}
}

func TestTargetDays(t *testing.T) {
	if TargetDays(30, 30) != 30 {
		t.Fatal("equal")
	}
	if TargetDays(30, 60) != 60 {
		t.Fatal("balance wins")
	}
	if TargetDays(45, 0) != 45 {
		t.Fatal("rw wins when no balance")
	}
	if TargetDays(-1, 10) != 10 {
		t.Fatal("negative rw")
	}
}

func TestNormalizePeriodDays(t *testing.T) {
	if NormalizePeriodDays(30) != 1 {
		t.Fatal("30")
	}
	if NormalizePeriodDays(90) != 3 {
		t.Fatal("90")
	}
	if NormalizePeriodDays(14) != 0 {
		t.Fatal("14 skipped")
	}
}

func TestMergeExpire(t *testing.T) {
	earlier := mustParseTime("2026-01-01T00:00:00Z")
	later := mustParseTime("2026-02-01T00:00:00Z")
	if got := mergeExpire(&earlier, &later); !got.Equal(later) {
		t.Fatalf("want later, got %v", got)
	}
	if got := mergeExpire(&later, &earlier); !got.Equal(later) {
		t.Fatalf("keep existing later, got %v", got)
	}
	if got := mergeExpire(nil, &later); !got.Equal(later) {
		t.Fatal("nil existing")
	}
}

func mustParseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return t
}
