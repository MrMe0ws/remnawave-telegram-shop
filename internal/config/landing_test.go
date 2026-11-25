package config

import (
	"strings"
	"testing"
)

func resetLandingSettings(t *testing.T) {
	t.Helper()
	patch := map[string]string{LandingLayoutKey: LandingLayoutHeroSide}
	for _, f := range landingTextFields {
		patch[f.key] = ""
	}
	for _, f := range landingBoolFields {
		patch[f.key] = "true"
	}
	if _, err := ApplyRuntimePatch(patch); err != nil {
		t.Fatal(err)
	}
}

// По умолчанию лендинг такой же, как до появления настроек: все блоки на месте,
// тарифы справа от первого экрана, своих текстов нет.
func TestLandingPublicDefaults(t *testing.T) {
	resetLandingSettings(t)
	got := LandingPublic()
	if got["layout"] != LandingLayoutHeroSide {
		t.Fatalf("layout = %v", got["layout"])
	}
	if texts := got["texts"].(map[string]string); len(texts) != 0 {
		t.Fatalf("пустые тексты не должны отдаваться: %v", texts)
	}
	for _, f := range landingBoolFields {
		if got[f.json] != true {
			t.Errorf("%s по умолчанию должен быть включён", f.json)
		}
	}
}

func TestLandingSettingsRoundTrip(t *testing.T) {
	resetLandingSettings(t)
	t.Cleanup(func() { resetLandingSettings(t) })

	if _, err := ApplyRuntimePatch(map[string]string{
		"LANDING_HERO_TITLE_AFTER": "  — VPN, который просто работает  ",
		"LANDING_SHOW_FAQ":         "false",
		LandingLayoutKey:           "after-steps",
	}); err != nil {
		t.Fatal(err)
	}
	got := LandingPublic()
	if v := got["texts"].(map[string]string)["hero_title_after"]; v != "— VPN, который просто работает" {
		t.Fatalf("текст должен храниться без пробелов по краям, получили %q", v)
	}
	if got["show_faq"] != false {
		t.Fatal("FAQ должен выключиться")
	}
	if got["layout"] != LandingLayoutAfterSteps {
		t.Fatalf("layout = %v", got["layout"])
	}

	if _, err := ApplyRuntimePatch(map[string]string{LandingLayoutKey: "sidebar"}); err == nil {
		t.Fatal("неизвестная раскладка должна отклоняться")
	}
	if _, err := ApplyRuntimePatch(map[string]string{"LANDING_HERO_SUBTITLE": strings.Repeat("я", 201)}); err == nil {
		t.Fatal("слишком длинный подзаголовок должен отклоняться")
	}
}
