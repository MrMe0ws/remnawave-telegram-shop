package database

import (
	"testing"
	"time"
)

func TestResolveStatsTimeSeriesWindowMonth(t *testing.T) {
	now := time.Date(2026, 6, 15, 14, 30, 0, 0, time.UTC)
	from, to, gran := ResolveStatsTimeSeriesWindow("month", now)
	if gran != statsGranularityDay {
		t.Fatalf("granularity = %q, want day", gran)
	}
	if from != time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC) {
		t.Fatalf("from = %v", from)
	}
	if to != time.Date(2026, 6, 16, 0, 0, 0, 0, time.UTC) {
		t.Fatalf("to = %v", to)
	}
}

func TestResolveStatsTimeSeriesWindowWeek(t *testing.T) {
	now := time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC)
	from, to, gran := ResolveStatsTimeSeriesWindow("week", now)
	if gran != statsGranularityDay {
		t.Fatalf("granularity = %q, want day", gran)
	}
	wantFrom := time.Date(2026, 6, 9, 0, 0, 0, 0, time.UTC)
	if !from.Equal(wantFrom) {
		t.Fatalf("from = %v, want %v", from, wantFrom)
	}
	if to != time.Date(2026, 6, 16, 0, 0, 0, 0, time.UTC) {
		t.Fatalf("to = %v", to)
	}
}

func TestGenerateStatsBucketsMonthDaily(t *testing.T) {
	from := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 6, 4, 0, 0, 0, 0, time.UTC)
	buckets := generateStatsBuckets(from, to, statsGranularityDay)
	if len(buckets) != 3 {
		t.Fatalf("len(buckets) = %d, want 3", len(buckets))
	}
}

func TestFormatStatsBucketDate(t *testing.T) {
	d := time.Date(2026, 6, 5, 23, 59, 0, 0, time.UTC)
	if got := formatStatsBucketDate(d); got != "2026-06-05" {
		t.Fatalf("formatStatsBucketDate = %q", got)
	}
}
