package translation

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/go-telegram/bot/models"
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

func (tm *Manager) InitTranslations(translationsDir string, defaultLanguage string) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if defaultLanguage != "" {
		tm.defaultLanguage = defaultLanguage
	}

	files, err := os.ReadDir(translationsDir)
	if err != nil {
		return fmt.Errorf("failed to read translation directory: %w", err)
	}

	type overlay struct {
		name string
		lang string
	}
	var overlays []overlay

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		baseName := strings.TrimSuffix(file.Name(), ".json")
		if strings.HasPrefix(baseName, "admin_") {
			lang := strings.TrimPrefix(baseName, "admin_")
			if lang == "" {
				return fmt.Errorf("invalid admin overlay file name %q (expected admin_<lang>.json)", file.Name())
			}
			overlays = append(overlays, overlay{name: file.Name(), lang: lang})
			continue
		}

		langCode := baseName
		filePath := filepath.Join(translationsDir, file.Name())

		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read translation file %s: %w", file.Name(), err)
		}

		var translation Translation
		if err := json.Unmarshal(content, &translation); err != nil {
			return fmt.Errorf("failed to parse translation file %s: %w", file.Name(), err)
		}

		if err := validateButtonStyles(translation, file.Name()); err != nil {
			return err
		}

		tm.translations[langCode] = translation
	}

	for _, o := range overlays {
		filePath := filepath.Join(translationsDir, o.name)
		content, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read translation file %s: %w", o.name, err)
		}

		var overlayTr Translation
		if err := json.Unmarshal(content, &overlayTr); err != nil {
			return fmt.Errorf("failed to parse translation file %s: %w", o.name, err)
		}

		if err := validateButtonStyles(overlayTr, o.name); err != nil {
			return err
		}

		base, ok := tm.translations[o.lang]
		if !ok {
			return fmt.Errorf("overlay %s: base language %q has no %s.json — load base file first", o.name, o.lang, o.lang)
		}
		mergeTranslations(base, overlayTr)
	}

	if _, exists := tm.translations[tm.defaultLanguage]; !exists {
		return fmt.Errorf("default language %s translation not found", tm.defaultLanguage)
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
