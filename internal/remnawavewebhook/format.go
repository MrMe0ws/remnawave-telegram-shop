package remnawavewebhook

import (
	"fmt"
	"html"
	"time"
)

// moscowLocation — TZ для отображения разбана (как в админке бота).
func moscowLocation() *time.Location {
	loc, err := time.LoadLocation("Europe/Moscow")
	if err != nil {
		return time.FixedZone("MSK", 3*60*60)
	}
	return loc
}

// FormatUnblockParts returns Moscow date (DD.MM.YYYY) and time (HH:MM) for templates like "%s в %s".
func FormatUnblockParts(t time.Time) (date, clock string) {
	if t.IsZero() {
		return "—", "—"
	}
	m := t.In(moscowLocation())
	return m.Format("02.01.2006"), m.Format("15:04")
}

// DurationMinutes prefers wall-clock span; falls back to blockDuration heuristic.
func DurationMinutes(blockDuration int, processedAt, willUnblockAt time.Time) int {
	if !processedAt.IsZero() && !willUnblockAt.IsZero() {
		d := willUnblockAt.Sub(processedAt)
		if d > 0 {
			m := int((d + time.Minute/2) / time.Minute)
			if m < 1 {
				return 1
			}
			return m
		}
	}
	if blockDuration <= 0 {
		return 0
	}
	// Panel plugin config is seconds; values >= 120 are treated as seconds.
	if blockDuration >= 120 {
		return (blockDuration + 59) / 60
	}
	return blockDuration
}

// FormatMessage builds localized text; tmpl: %s node, %d minutes, %s date, %s time.
func FormatMessage(tmpl, nodeName string, durationMin int, unblockAt time.Time) string {
	if nodeName == "" {
		nodeName = "—"
	}
	date, clock := FormatUnblockParts(unblockAt)
	return fmt.Sprintf(tmpl, html.EscapeString(nodeName), durationMin, date, clock)
}
