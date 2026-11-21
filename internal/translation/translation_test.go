package translation

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// Том translations отстал от релиза: нового ключа на диске нет, но он есть в
// образе — бот не должен показывать сырой идентификатор. Правка владельца на
// диске при этом остаётся в силе.
func TestInitTranslationsFillsMissingKeysFromBundle(t *testing.T) {
	dir := t.TempDir()
	// На диске нет ни одного ключа релиза, кроме переопределённого.
	if err := os.WriteFile(filepath.Join(dir, "ru.json"), []byte(`{"start_message": "Мой старт"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	tm := &Manager{translations: map[string]Translation{}, defaultLanguage: "ru"}
	if err := tm.InitTranslations(dir, "ru"); err != nil {
		t.Fatal(err)
	}

	if got := tm.GetText("ru", "start_message"); got != "Мой старт" {
		t.Fatalf("правка с диска потеряна: %q", got)
	}
	// Любой другой ключ из вшитого ru.json должен быть доступен.
	bundledOnly := tm.GetText("ru", "yookasa_alfa_pay_button")
	if bundledOnly == "yookasa_alfa_pay_button" || bundledOnly == "" {
		t.Fatalf("ключ из образа не подтянулся: %q", bundledOnly)
	}
}

func TestInitTranslationsWithoutDiskDirUsesBundle(t *testing.T) {
	tm := &Manager{translations: map[string]Translation{}, defaultLanguage: "ru"}
	if err := tm.InitTranslations(filepath.Join(t.TempDir(), "нет-такой"), "ru"); err != nil {
		t.Fatal(err)
	}
	if tm.GetText("ru", "yookasa_alfa_pay_button") == "yookasa_alfa_pay_button" {
		t.Fatal("вшитые тексты не загрузились")
	}
}

func TestDeepMergeJSONKeepsOwnerArrays(t *testing.T) {
	base := `{"a": {"x": 1, "y": 2}, "list": [{"id":"one"},{"id":"two"}]}`
	over := `{"a": {"y": 20}, "list": [{"id":"one"}]}`
	out, err := DeepMergeJSON([]byte(base), []byte(over))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		A    map[string]int   `json:"a"`
		List []map[string]any `json:"list"`
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.A["x"] != 1 || got.A["y"] != 20 {
		t.Fatalf("объекты слиты неверно: %v", got.A)
	}
	if len(got.List) != 1 {
		t.Fatalf("удалённый владельцем пункт вернулся: %v", got.List)
	}
}
