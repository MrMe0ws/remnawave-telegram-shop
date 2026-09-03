package config

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Авто-расписание декор-тем кабинета (CABINET_DECOR_SCHEDULE).
//
// Правило — окно «с ДД.ММ по ДД.ММ», внутри которого включается своя тема
// (Новый год с декабря по январь, Хэллоуин за неделю до и неделю после и т.д.).
// Год в правилах не хранится: окно повторяется каждый год, а окно с переходом
// через 31 декабря (from > to) считается непрерывным.
//
// Живёт в internal/config, а не в internal/cabinet/config, потому что валидация
// нужна реестру runtime-настроек, а тому нельзя импортировать пакет кабинета —
// получится цикл импортов (см. cabinet-decor-themes.md).

// MaxDecorScheduleRules — потолок на размер JSON из админки.
const MaxDecorScheduleRules = 30

// DecorScheduleRule — одно окно авто-темы. From/To — "MM-DD".
type DecorScheduleRule struct {
	Theme   string `json:"theme"`
	From    string `json:"from"`
	To      string `json:"to"`
	Enabled *bool  `json:"enabled,omitempty"`
}

// IsEnabled — правило без явного enabled считается включённым: так окно,
// дописанное руками в .env, работает без лишнего поля.
func (r DecorScheduleRule) IsEnabled() bool {
	return r.Enabled == nil || *r.Enabled
}

// defaultDecorSchedule — пресет «по умолчанию»: пустой CABINET_DECOR_SCHEDULE
// означает именно его, чтобы галочка «включить авто-темы» работала сама по себе.
// Порядок важен: побеждает первое совпавшее правило, поэтому праздники стоят
// выше сезонов.
var defaultDecorSchedule = []DecorScheduleRule{
	{Theme: "new_year", From: "12-01", To: "01-31"},
	{Theme: "valentine", From: "02-07", To: "02-21"},
	{Theme: "halloween", From: "10-24", To: "11-07"},
	{Theme: "black_friday", From: "11-21", To: "11-30"},
	{Theme: "spring", From: "03-01", To: "05-31"},
	{Theme: "summer", From: "06-01", To: "08-31"},
}

// DefaultDecorSchedule — копия пресета (вызывающий может её править).
func DefaultDecorSchedule() []DecorScheduleRule {
	out := make([]DecorScheduleRule, len(defaultDecorSchedule))
	copy(out, defaultDecorSchedule)
	return out
}

// ParseDecorSchedule — разбор и валидация JSON-массива правил.
// Пустая строка — пустой список без ошибки (значение по умолчанию подставляет
// вызывающий, см. DecorScheduleRules).
func ParseDecorSchedule(raw string) ([]DecorScheduleRule, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	var rules []DecorScheduleRule
	if err := json.Unmarshal([]byte(trimmed), &rules); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	if len(rules) > MaxDecorScheduleRules {
		return nil, fmt.Errorf("too many rules: %d (max %d)", len(rules), MaxDecorScheduleRules)
	}
	allowed := cabinetDecorThemeSet()
	out := make([]DecorScheduleRule, 0, len(rules))
	for i, r := range rules {
		theme := strings.TrimSpace(strings.ToLower(r.Theme))
		if _, ok := allowed[theme]; !ok {
			return nil, fmt.Errorf("rule %d: invalid decor theme %q", i+1, r.Theme)
		}
		from, err := normalizeMonthDay(r.From)
		if err != nil {
			return nil, fmt.Errorf("rule %d: from: %w", i+1, err)
		}
		to, err := normalizeMonthDay(r.To)
		if err != nil {
			return nil, fmt.Errorf("rule %d: to: %w", i+1, err)
		}
		enabled := r.IsEnabled()
		out = append(out, DecorScheduleRule{Theme: theme, From: from, To: to, Enabled: &enabled})
	}
	return out, nil
}

// monthDayCode — "MM-DD" → MM*100+DD; 0, если формат неверный.
func monthDayCode(value string) int {
	m, d, ok := splitMonthDay(value)
	if !ok {
		return 0
	}
	return m*100 + d
}

func splitMonthDay(value string) (month, day int, ok bool) {
	parts := strings.Split(strings.TrimSpace(value), "-")
	if len(parts) != 2 {
		return 0, 0, false
	}
	m, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, false
	}
	d, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, false
	}
	return m, d, true
}

// daysInMonth — 29 февраля разрешено: правило годовое, а не про конкретный год.
var daysInMonth = [13]int{0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}

func normalizeMonthDay(value string) (string, error) {
	m, d, ok := splitMonthDay(value)
	if !ok {
		return "", fmt.Errorf("expected MM-DD, got %q", value)
	}
	if m < 1 || m > 12 {
		return "", fmt.Errorf("month out of range in %q", value)
	}
	if d < 1 || d > daysInMonth[m] {
		return "", fmt.Errorf("day out of range in %q", value)
	}
	return fmt.Sprintf("%02d-%02d", m, d), nil
}

// DecorRuleMatches — попадает ли дата в окно правила.
func DecorRuleMatches(rule DecorScheduleRule, at time.Time) bool {
	if !rule.IsEnabled() {
		return false
	}
	from := monthDayCode(rule.From)
	to := monthDayCode(rule.To)
	if from == 0 || to == 0 {
		return false
	}
	cur := int(at.Month())*100 + at.Day()
	if from <= to {
		return cur >= from && cur <= to
	}
	// Окно через Новый год: 12-01 → 01-31.
	return cur >= from || cur <= to
}

// ResolveDecorScheduleTheme — первая подходящая тема или "" если совпадений нет.
func ResolveDecorScheduleTheme(rules []DecorScheduleRule, at time.Time) string {
	for _, r := range rules {
		if DecorRuleMatches(r, at) {
			return r.Theme
		}
	}
	return ""
}

// applyCabinetDecorSchedule — только валидация: JSON хранится как прислала
// админка. Нормализация («1-31» → «01-31») делается при чтении, а
// ApplyRuntimePatch всё равно кладёт в override исходную строку — ту же, что
// уходит в bot_runtime_settings.
func applyCabinetDecorSchedule() func(string) error {
	return func(value string) error {
		if _, err := ParseDecorSchedule(value); err != nil {
			return err
		}
		setRuntimeOverride("CABINET_DECOR_SCHEDULE", strings.TrimSpace(value))
		return nil
	}
}

func cabinetDecorScheduleCurrent() func() string {
	return func() string { return strings.TrimSpace(effectiveEnvUnderRLock("CABINET_DECOR_SCHEDULE")) }
}
