package config

import (
	"testing"
)

func TestApplyRuntimePatch_loyaltyToggle(t *testing.T) {
	orig := conf.loyaltyEnabled
	t.Cleanup(func() {
		confMu.Lock()
		conf.loyaltyEnabled = orig
		delete(runtimeOverrideSet, "LOYALTY_ENABLED")
		delete(runtimeOverrides, "LOYALTY_ENABLED")
		confMu.Unlock()
	})

	changed, err := ApplyRuntimePatch(map[string]string{"LOYALTY_ENABLED": "false"})
	if err != nil {
		t.Fatal(err)
	}
	if len(changed) != 1 || changed[0] != "LOYALTY_ENABLED" {
		t.Fatalf("changed=%v", changed)
	}
	if LoyaltyEnabled() {
		t.Fatal("expected loyalty disabled")
	}
	if SettingSource("LOYALTY_ENABLED") != "db" {
		t.Fatalf("source=%s", SettingSource("LOYALTY_ENABLED"))
	}
}

func TestApplyRuntimePatch_unknownKeyRejected(t *testing.T) {
	_, err := ApplyRuntimePatch(map[string]string{"TELEGRAM_TOKEN": "x"})
	if err == nil {
		t.Fatal("expected error for secret key")
	}
}

func TestApplyRuntimePatch_remnaTagFormat(t *testing.T) {
	_, err := ApplyRuntimePatch(map[string]string{"REMNAWAVE_TAG": "bad-tag"})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestParseTelegramIDList(t *testing.T) {
	m, err := parseTelegramIDList("123, 456")
	if err != nil {
		t.Fatal(err)
	}
	if !m[123] || !m[456] {
		t.Fatalf("map=%v", m)
	}
	_, err = parseTelegramIDList("abc")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestEffectiveEnv_override(t *testing.T) {
	confMu.Lock()
	runtimeOverrides["FORTUNE_ENABLED"] = "true"
	runtimeOverrideSet["FORTUNE_ENABLED"] = struct{}{}
	confMu.Unlock()
	t.Cleanup(func() {
		confMu.Lock()
		delete(runtimeOverrides, "FORTUNE_ENABLED")
		delete(runtimeOverrideSet, "FORTUNE_ENABLED")
		confMu.Unlock()
	})
	if EffectiveEnv("FORTUNE_ENABLED") != "true" {
		t.Fatalf("got %q", EffectiveEnv("FORTUNE_ENABLED"))
	}
}
