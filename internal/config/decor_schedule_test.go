package config

import (
	"testing"
	"time"
)

func TestParseDecorSchedule_valid(t *testing.T) {
	rules, err := ParseDecorSchedule(`[{"theme":"NEW_YEAR","from":"12-1","to":"1-31","enabled":true}]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rules) != 1 {
		t.Fatalf("want 1 rule, got %d", len(rules))
	}
	if rules[0].Theme != "new_year" || rules[0].From != "12-01" || rules[0].To != "01-31" {
		t.Fatalf("not normalized: %+v", rules[0])
	}
	if !rules[0].IsEnabled() {
		t.Fatal("rule must be enabled")
	}
}

func TestParseDecorSchedule_enabledDefaultsToTrue(t *testing.T) {
	rules, err := ParseDecorSchedule(`[{"theme":"halloween","from":"10-24","to":"11-07"}]`)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !rules[0].IsEnabled() {
		t.Fatal("rule without explicit enabled must count as enabled")
	}
}

func TestParseDecorSchedule_invalid(t *testing.T) {
	cases := map[string]string{
		"broken json":   `[{"theme":`,
		"unknown theme": `[{"theme":"easter","from":"04-01","to":"04-10"}]`,
		"bad month":     `[{"theme":"summer","from":"13-01","to":"14-02"}]`,
		"bad day":       `[{"theme":"summer","from":"06-31","to":"08-31"}]`,
		"bad format":    `[{"theme":"summer","from":"0601","to":"08-31"}]`,
	}
	for name, raw := range cases {
		if _, err := ParseDecorSchedule(raw); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}

func TestParseDecorSchedule_empty(t *testing.T) {
	rules, err := ParseDecorSchedule("  ")
	if err != nil || rules != nil {
		t.Fatalf("want (nil, nil), got (%v, %v)", rules, err)
	}
}

func TestParseDecorSchedule_tooManyRules(t *testing.T) {
	raw := "["
	for i := 0; i <= MaxDecorScheduleRules; i++ {
		if i > 0 {
			raw += ","
		}
		raw += `{"theme":"green","from":"01-01","to":"01-02"}`
	}
	raw += "]"
	if _, err := ParseDecorSchedule(raw); err == nil {
		t.Fatal("expected error on oversized schedule")
	}
}

func TestResolveDecorScheduleTheme(t *testing.T) {
	rules := DefaultDecorSchedule()
	cases := []struct {
		date time.Time
		want string
	}{
		{time.Date(2026, 12, 20, 12, 0, 0, 0, time.UTC), "new_year"},
		{time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC), "new_year"},
		{time.Date(2026, 2, 14, 12, 0, 0, 0, time.UTC), "valentine"},
		{time.Date(2026, 2, 8, 12, 0, 0, 0, time.UTC), "valentine"},
		{time.Date(2026, 10, 31, 12, 0, 0, 0, time.UTC), "halloween"},
		{time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC), "halloween"},
		{time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC), "black_friday"},
		{time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC), "summer"},
		{time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC), ""},
	}
	for _, c := range cases {
		if got := ResolveDecorScheduleTheme(rules, c.date); got != c.want {
			t.Errorf("%s: got %q, want %q", c.date.Format("2006-01-02"), got, c.want)
		}
	}
}

func TestResolveDecorScheduleTheme_firstMatchWins(t *testing.T) {
	off := false
	rules := []DecorScheduleRule{
		{Theme: "valentine", From: "02-01", To: "02-28", Enabled: &off},
		{Theme: "pink", From: "02-10", To: "02-20"},
		{Theme: "green", From: "02-14", To: "02-14"},
	}
	got := ResolveDecorScheduleTheme(rules, time.Date(2026, 2, 14, 0, 0, 0, 0, time.UTC))
	if got != "pink" {
		t.Fatalf("got %q, want pink (disabled rule skipped, first match wins)", got)
	}
}

func TestApplyRuntimePatch_cabinetDecorSchedule(t *testing.T) {
	changed, err := ApplyRuntimePatch(map[string]string{
		"CABINET_DECOR_SCHEDULE": `[{"theme":"halloween","from":"10-24","to":"11-7"}]`,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(changed) != 1 || changed[0] != "CABINET_DECOR_SCHEDULE" {
		t.Fatalf("changed = %v", changed)
	}
	if got := EffectiveEnv("CABINET_DECOR_SCHEDULE"); got != `[{"theme":"halloween","from":"10-24","to":"11-7"}]` {
		t.Fatalf("stored value = %s", got)
	}
	rules, err := ParseDecorSchedule(EffectiveEnv("CABINET_DECOR_SCHEDULE"))
	if err != nil {
		t.Fatalf("stored value must stay parsable: %v", err)
	}
	if rules[0].To != "11-07" {
		t.Fatalf("reader must normalize the day: %+v", rules[0])
	}
	t.Cleanup(func() {
		confMu.Lock()
		delete(runtimeOverrides, "CABINET_DECOR_SCHEDULE")
		delete(runtimeOverrideSet, "CABINET_DECOR_SCHEDULE")
		confMu.Unlock()
	})
}

func TestApplyRuntimePatch_cabinetDecorScheduleInvalid(t *testing.T) {
	if _, err := ApplyRuntimePatch(map[string]string{
		"CABINET_DECOR_SCHEDULE": `[{"theme":"easter","from":"04-01","to":"04-10"}]`,
	}); err == nil {
		t.Fatal("expected error for unknown theme")
	}
}
