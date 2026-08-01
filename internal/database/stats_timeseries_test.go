package database

import (
	"errors"
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

func TestResolveStatsTimeSeriesCustomWindowMayJune(t *testing.T) {
	now := time.Date(2026, 8, 1, 12, 0, 0, 0, time.UTC)
	fromDate := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	toDate := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	from, to, gran, err := ResolveStatsTimeSeriesCustomWindow(fromDate, toDate, now)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if gran != statsGranularityDay {
		t.Fatalf("granularity = %q, want day (32 days)", gran)
	}
	if !from.Equal(time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("from = %v", from)
	}
	if !to.Equal(time.Date(2026, 6, 2, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("to = %v (half-open)", to)
	}
}

func TestResolveStatsTimeSeriesCustomWindowGranularity(t *testing.T) {
	now := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name     string
		from, to time.Time
		wantGran string
	}{
		{
			name:     "45d_day",
			from:     time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			to:       time.Date(2026, 2, 14, 0, 0, 0, 0, time.UTC), // 45 days
			wantGran: statsGranularityDay,
		},
		{
			name:     "46d_week",
			from:     time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			to:       time.Date(2026, 2, 15, 0, 0, 0, 0, time.UTC), // 46 days
			wantGran: statsGranularityWeek,
		},
		{
			name:     "181d_month",
			from:     time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			to:       time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC), // 181 days
			wantGran: statsGranularityMonth,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, gran, err := ResolveStatsTimeSeriesCustomWindow(tc.from, tc.to, now)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if gran != tc.wantGran {
				t.Fatalf("gran = %q, want %q", gran, tc.wantGran)
			}
		})
	}
}

func TestResolveStatsTimeSeriesCustomWindowInvalid(t *testing.T) {
	now := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)

	_, _, _, err := ResolveStatsTimeSeriesCustomWindow(
		time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC),
		now,
	)
	if err == nil || !errors.Is(err, ErrInvalidStatsTimeSeriesRange) {
		t.Fatalf("want ErrInvalidStatsTimeSeriesRange, got %v", err)
	}

	_, _, _, err = ResolveStatsTimeSeriesCustomWindow(
		time.Date(2026, 8, 10, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC),
		now,
	)
	if err == nil || !errors.Is(err, ErrInvalidStatsTimeSeriesRange) {
		t.Fatalf("future range: want ErrInvalidStatsTimeSeriesRange, got %v", err)
	}

	// to на 1 день впереди UTC «сегодня» — clamp, не ошибка (TZ UTC+)
	from, to, err2 := func() (time.Time, time.Time, error) {
		f, tExcl, _, e := ResolveStatsTimeSeriesCustomWindow(
			time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
			time.Date(2026, 8, 2, 0, 0, 0, 0, time.UTC), // now=Aug1 → maxTo=Aug2
			now,
		)
		return f, tExcl, e
	}()
	if err2 != nil {
		t.Fatalf("tz grace clamp: unexpected err %v", err2)
	}
	if !to.Equal(time.Date(2026, 8, 3, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("clamped to half-open = %v", to)
	}
	if !from.Equal(time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("from = %v", from)
	}

	_, _, _, err = ResolveStatsTimeSeriesCustomWindow(
		time.Date(2022, 1, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC),
		now,
	)
	if err == nil || !errors.Is(err, ErrInvalidStatsTimeSeriesRange) {
		t.Fatalf("too long: want ErrInvalidStatsTimeSeriesRange, got %v", err)
	}
}
