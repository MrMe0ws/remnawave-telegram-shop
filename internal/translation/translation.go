package translation

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/go-telegram/bot/models"

	translationfs "remnawave-tg-shop-bot/translations"
)

type Translation map[string]TranslationValue

type TranslationValue struct {
	Text   string
	Button *ButtonData
}

type ButtonData struct {
	Text    string `json:"text"`
	Style   string `json:"style,omitempty"`
	EmojiID string `json:"emoji_id,omitempty"`
}

func (v *TranslationValue) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		return nil
	}
	if data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		v.Text = s
		v.Button = nil
		return nil
	}

	var btn ButtonData
	if err := json.Unmarshal(data, &btn); err != nil {
		return err
	}
	v.Text = btn.Text
	v.Button = &btn
	return nil
}

type Manager struct {
	translations    map[string]Translation
	defaultLanguage string
	mu              sync.RWMutex
}

var (
	instance *Manager
	once     sync.Once
)

func GetInstance() *Manager {
	once.Do(func() {
		instance = &Manager{
			translations:    make(map[string]Translation),
			defaultLanguage: "en",
		}
	})
	return instance
}

func mergeTranslations(dst Translation, src Translation) {
	for k, v := range src {
		dst[k] = v
	}
}

// langFile — один JSON-файл переводов: имя без пути и содержимое.
type langFile struct {
	name    string
	content []byte
}

// InitTranslations грузит тексты, вшитые в бинарник, а поверх них — файлы из
// translationsDir (том на сервере). Диск перекрывает только свои ключи: всё,
// чего на томе ещё нет (новая кнопка в свежем релизе), остаётся из образа.
func (tm *Manager) InitTranslations(translationsDir string, defaultLanguage string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if defaultLanguage != "" {
		tm.defaultLanguage = defaultLanguage
	}
	tm.translations = make(map[string]Translation)

	bundled, err := readFSLangFiles(translationfs.FS)
	if err != nil {
		return fmt.Errorf("bundled translations: %w", err)
	}
	if err := tm.applyLangFiles(bundled); err != nil {
		return fmt.Errorf("bundled translations: %w", err)
	}

	if translationsDir != "" {
		disk, err := readDirLangFiles(translationsDir)
		switch {
		case err == nil:
			if err := tm.applyLangFiles(disk); err != nil {
				return err
			}
		case os.IsNotExist(err):
			// Нет папки — работаем на вшитых текстах.
		default:
			return fmt.Errorf("failed to read translation directory: %w", err)
		}
	}

	if _, exists := tm.translations[tm.defaultLanguage]; !exists {
		return fmt.Errorf("default language %s translation not found", tm.defaultLanguage)
	}
	return nil
}

func readFSLangFiles(fsys fs.FS) ([]langFile, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, err
	}
	var out []langFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := fs.ReadFile(fsys, e.Name())
		if err != nil {
			return nil, fmt.Errorf("failed to read translation file %s: %w", e.Name(), err)
		}
		out = append(out, langFile{name: e.Name(), content: b})
	}
	return out, nil
}

func readDirLangFiles(dir string) ([]langFile, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var out []langFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return nil, fmt.Errorf("failed to read translation file %s: %w", e.Name(), err)
		}
		out = append(out, langFile{name: e.Name(), content: b})
	}
	return out, nil
}

// applyLangFiles накладывает набор файлов на уже загруженные переводы: сначала
// базовые <lang>.json, затем admin_<lang>.json поверх своего языка.
func (tm *Manager) applyLangFiles(files []langFile) error {
	var overlays []langFile
	for _, f := range files {
		baseName := strings.TrimSuffix(f.name, ".json")
		if strings.HasPrefix(baseName, "admin_") {
			if strings.TrimPrefix(baseName, "admin_") == "" {
				return fmt.Errorf("invalid admin overlay file name %q (expected admin_<lang>.json)", f.name)
			}
			overlays = append(overlays, f)
			continue
		}

		var tr Translation
		if err := json.Unmarshal(f.content, &tr); err != nil {
			return fmt.Errorf("failed to parse translation file %s: %w", f.name, err)
		}
		if err := validateButtonStyles(tr, f.name); err != nil {
			return err
		}
		if base, ok := tm.translations[baseName]; ok {
			mergeTranslations(base, tr)
		} else {
			tm.translations[baseName] = tr
		}
	}

	for _, f := range overlays {
		lang := strings.TrimPrefix(strings.TrimSuffix(f.name, ".json"), "admin_")
		var tr Translation
		if err := json.Unmarshal(f.content, &tr); err != nil {
			return fmt.Errorf("failed to parse translation file %s: %w", f.name, err)
		}
		if err := validateButtonStyles(tr, f.name); err != nil {
			return err
		}
		base, ok := tm.translations[lang]
		if !ok {
			return fmt.Errorf("overlay %s: base language %q has no %s.json — load base file first", f.name, lang, lang)
		}
		mergeTranslations(base, tr)
	}
	return nil
}

func (tm *Manager) GetText(langCode, key string) string {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if translation, exists := tm.translations[langCode]; exists {
		if value, exists := translation[key]; exists && value.Text != "" {
			return value.Text
		}
	}

	if translation, exists := tm.translations[tm.defaultLanguage]; exists {
		if value, exists := translation[key]; exists {
			return value.Text
		}
	}

	return key
}

func (tm *Manager) GetButton(langCode, key string) ButtonData {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if translation, exists := tm.translations[langCode]; exists {
		if value, exists := translation[key]; exists {
			return resolveButtonValue(value, key)
		}
	}

	if translation, exists := tm.translations[tm.defaultLanguage]; exists {
		if value, exists := translation[key]; exists {
			return resolveButtonValue(value, key)
		}
	}

	return ButtonData{Text: key}
}

func (tm *Manager) WithButton(langCode, key string, button models.InlineKeyboardButton) models.InlineKeyboardButton {
	data := tm.GetButton(langCode, key)
	button.Text = data.Text
	if data.EmojiID != "" {
		button.IconCustomEmojiID = data.EmojiID
	}
	if data.Style != "" {
		if style, ok := parseButtonStyle(data.Style); ok {
			button.Style = style
		}
	}
	return button
}

func resolveButtonValue(value TranslationValue, key string) ButtonData {
	if value.Button != nil {
		btn := *value.Button
		if btn.Text == "" {
			btn.Text = key
		}
		return btn
	}
	if value.Text != "" {
		return ButtonData{Text: value.Text}
	}
	return ButtonData{Text: key}
}

func parseButtonStyle(style string) (string, bool) {
	switch strings.ToLower(style) {
	case "primary", "blue":
		return "primary", true
	case "success", "sucess", "green":
		return "success", true
	case "danger", "red":
		return "danger", true
	default:
		return "", false
	}
}

func validateButtonStyles(translation Translation, fileName string) error {
	_ = fileName
	return nil
}
