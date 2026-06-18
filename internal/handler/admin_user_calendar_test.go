package handler

import (
	"testing"
	"time"
)

func TestParseAdminExpireDateInput(t *testing.T) {
	tests := []struct {
		name string
		in   string
		ok   bool
		want time.Time
	}{
		{
			name: "date only dotted end of day",
			in:   "18.06.2026",
			ok:   true,
			want: time.Date(2026, 6, 18, 23, 59, 59, 0, time.UTC),
		},
		{
			name: "date only iso end of day",
			in:   "2026-06-18",
			ok:   true,
			want: time.Date(2026, 6, 18, 23, 59, 59, 0, time.UTC),
		},
		{
			name: "dotted with hh:mm",
			in:   "18.06.2026 13:21",
			ok:   true,
			want: time.Date(2026, 6, 18, 13, 21, 0, 0, time.UTC),
		},
		{
			name: "iso with hh:mm",
			in:   "2026-06-18 13:21",
			ok:   true,
			want: time.Date(2026, 6, 18, 13, 21, 0, 0, time.UTC),
		},
		{
			name: "iso with hh:mm:ss",
			in:   "2026-06-18 13:21:45",
			ok:   true,
			want: time.Date(2026, 6, 18, 13, 21, 45, 0, time.UTC),
		},
		{
			name: "slash date with time",
			in:   "18/06/2026 09:30",
			ok:   true,
			want: time.Date(2026, 6, 18, 9, 30, 0, 0, time.UTC),
		},
		{
			name: "invalid time",
			in:   "18.06.2026 25:00",
			ok:   false,
		},
		{
			name: "invalid date",
			in:   "32.06.2026",
			ok:   false,
		},
		{
			name: "empty",
			in:   "",
			ok:   false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := parseAdminExpireDateInput(tt.in)
			if ok != tt.ok {
				t.Fatalf("ok = %v, want %v", ok, tt.ok)
			}
			if !tt.ok {
				return
			}
			if !got.Equal(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExpireAtEndOfDayUTC(t *testing.T) {
	in := time.Date(2026, 6, 18, 12, 0, 0, 0, time.UTC)
	got := expireAtEndOfDayUTC(in)
	want := time.Date(2026, 6, 18, 23, 59, 59, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}
