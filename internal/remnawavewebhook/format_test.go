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

func TestFormatUnblockParts_Moscow(t *testing.T) {
	// 09:56 UTC = 12:56 MSK
	utc := time.Date(2026, 8, 7, 9, 56, 41, 0, time.UTC)
	date, clock := FormatUnblockParts(utc)
	if date != "07.08.2026" || clock != "12:56" {
		t.Fatalf("got %q %q", date, clock)
	}
}

func TestFormatMessage(t *testing.T) {
	tmpl := "⛔️ <b>Сервер «%s» временно заблокирован</b>\n\n⏱️ Блокировка на %d минут\n🔓 Снова доступен: %s в %s"
	unblock := time.Date(2026, 8, 9, 15, 6, 0, 0, time.UTC) // 18:06 MSK
	got := FormatMessage(tmpl, "Латвия", 60, unblock)
	if !strings.Contains(got, "«Латвия»") || !strings.Contains(got, "60 минут") || !strings.Contains(got, "09.08.2026 в 18:06") {
		t.Fatalf("unexpected message: %s", got)
	}
	escaped := FormatMessage(tmpl, `Evil <b>x</b> & "y"`, 10, unblock)
	if strings.Contains(escaped, "<b>x</b>") || !strings.Contains(escaped, "&lt;b&gt;x&lt;/b&gt;") {
		t.Fatalf("expected HTML-escaped node name, got %s", escaped)
	}
}
