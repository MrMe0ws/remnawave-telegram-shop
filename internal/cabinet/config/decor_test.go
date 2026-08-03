package config

import (
	"os"
	"testing"
)

func TestDecorTheme_defaultOff(t *testing.T) {
	_ = os.Unsetenv("CABINET_DECOR_THEME")
	if got := DecorTheme(); got != "off" {
		t.Fatalf("got %q", got)
	}
}

func TestDecorTheme_knownValue(t *testing.T) {
	t.Setenv("CABINET_DECOR_THEME", "green")
	if got := DecorTheme(); got != "green" {
		t.Fatalf("got %q", got)
	}
}

func TestDecorTheme_unknownFallsBackToOff(t *testing.T) {
	t.Setenv("CABINET_DECOR_THEME", "easter")
	if got := DecorTheme(); got != "off" {
		t.Fatalf("got %q", got)
	}
}

func TestDecorTheme_atmosphericPresets(t *testing.T) {
	for _, id := range []string{"violet", "slate", "aurora", "ocean", "cyber", "sunset", "lavender"} {
		t.Run(id, func(t *testing.T) {
			t.Setenv("CABINET_DECOR_THEME", id)
			if got := DecorTheme(); got != id {
				t.Fatalf("got %q", got)
			}
			if !IsValidDecorTheme(id) {
				t.Fatalf("expected %q valid", id)
			}
		})
	}
}
