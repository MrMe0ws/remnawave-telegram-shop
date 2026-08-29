package handlers

import (
	"testing"

	"remnawave-tg-shop-bot/internal/config"
)

// Порядок групп в buildAdminSettingsResponse работает белым списком: группы,
// которой в нём нет, в ответе не будет, и в админке она просто не появится —
// без ошибки, просто пустое место. Именно так «Мой налог» уехал в релиз
// невидимым. Тест держит реестр и список синхронными.
func TestEveryRegistryGroupIsDisplayed(t *testing.T) {
	displayed := make(map[string]bool)
	for _, g := range buildAdminSettingsResponse().Groups {
		displayed[g.ID] = true
	}

	seen := make(map[string]bool)
	for _, f := range config.RuntimeSettingsRegistry() {
		if seen[f.Group] {
			continue
		}
		seen[f.Group] = true
		if !displayed[f.Group] {
			t.Errorf("группа %q есть в реестре настроек, но не отдаётся админке — "+
				"добавьте её в order в buildAdminSettingsResponse", f.Group)
		}
	}

	if len(seen) == 0 {
		t.Fatal("реестр настроек пуст — тест ничего не проверил")
	}
}

// Группа «Мой налог» должна доезжать до админки со всеми тремя настройками:
// включением, способами оплаты и сроком повторов.
func TestMoynalogGroupIsExposed(t *testing.T) {
	var fields []string
	for _, g := range buildAdminSettingsResponse().Groups {
		if g.ID != "moynalog" {
			continue
		}
		for _, f := range g.Fields {
			fields = append(fields, f.Key)
		}
	}

	if len(fields) == 0 {
		t.Fatal("группа moynalog не отдаётся админке")
	}

	want := []string{"MOYNALOG_ENABLED", "MOYNALOG_RECEIPT_FOR", "MOYNALOG_RETRY_MAX_AGE_HOURS"}
	for _, key := range want {
		found := false
		for _, got := range fields {
			if got == key {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("настройка %q не отдаётся в группе moynalog (есть: %v)", key, fields)
		}
	}
}
