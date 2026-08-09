package remnawavewebhook

import (
	"strings"
	"testing"
	"time"
)

func TestDurationMinutes_fromTimestamps(t *testing.T) {
	processed := time.Date(2026, 8, 7, 9, 56, 41, 0, time.UTC)
	unblock := processed.Add(60 * time.Minute)
	got := DurationMinutes(3600, processed, unblock)
	if got != 60 {
		t.Fatalf("got %d want 60", got)
	}
}

func TestDurationMinutes_secondsHeuristic(t *testing.T) {
	if got := DurationMinutes(3600, time.Time{}, time.Time{}); got != 60 {
		t.Fatalf("got %d want 60", got)
	}
	if got := DurationMinutes(60, time.Time{}, time.Time{}); got != 60 {
		t.Fatalf("got %d want 60 (minutes)", got)
	}
}

func TestFormatUnblockAt_Moscow(t *testing.T) {
	// 09:56 UTC = 12:56 MSK
	utc := time.Date(2026, 8, 7, 9, 56, 41, 0, time.UTC)
	got := FormatUnblockAt(utc)
	if got != "07.08.2026 12:56" {
		t.Fatalf("got %q", got)
	}
}

func TestFormatMessage(t *testing.T) {
	tmpl := "⛔ <b>Временная блокировка</b>\n\nНа сервере «%s»...\n\nДлительность: %d мин\nРазблокировка: %s"
	unblock := time.Date(2026, 8, 7, 9, 56, 0, 0, time.UTC)
	got := FormatMessage(tmpl, "Латвия", 60, unblock)
	if !strings.Contains(got, "«Латвия»") || !strings.Contains(got, "60 мин") || !strings.Contains(got, "07.08.2026 12:56") {
		t.Fatalf("unexpected message: %s", got)
	}
	escaped := FormatMessage(tmpl, `Evil <b>x</b> & "y"`, 10, unblock)
	if strings.Contains(escaped, "<b>x</b>") || !strings.Contains(escaped, "&lt;b&gt;x&lt;/b&gt;") {
		t.Fatalf("expected HTML-escaped node name, got %s", escaped)
	}
}
