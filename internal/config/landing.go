package config

import "strings"

// Лендинг: тексты первого экрана, заголовки блоков, какие блоки показывать и
// где стоит витрина тарифов. Всё в runtime-настройках (БД поверх env), меняется
// без перезапуска. Пустой текст значит «оставить перевод кабинета»; свой текст
// заменяет фразу целиком и показывается на всех языках.
//
// Списки (вопросы FAQ, шаги, карточки возможностей) сюда не входят — они
// остаются в переводах.

const LandingLayoutKey = "LANDING_LAYOUT"

// Раскладки лендинга — синхронно с web/cabinet/src/features/landing/landingLayout.ts.
const (
	LandingLayoutHeroSide   = "hero-side"
	LandingLayoutAfterHero  = "after-hero"
	LandingLayoutAfterSteps = "after-steps"
)

var landingLayouts = []string{LandingLayoutHeroSide, LandingLayoutAfterHero, LandingLayoutAfterSteps}

// landingTextField — текстовая настройка лендинга: ключ, имя в bootstrap, лимит.
type landingTextField struct {
	key      string
	json     string
	maxRunes int
}

var landingTextFields = []landingTextField{
	// Первый экран.
	{"LANDING_HERO_TITLE_BEFORE", "hero_title_before", 80},
	{"LANDING_HERO_TITLE_AFTER", "hero_title_after", 120},
	{"LANDING_HERO_SUBTITLE", "hero_subtitle", 200},
	{"LANDING_PANEL_TRAFFIC_VALUE", "panel_traffic_value", 40},
	// Заголовки блоков.
	{"LANDING_STEPS_TITLE", "steps_title", 120},
	{"LANDING_STEPS_SUBTITLE", "steps_subtitle", 280},
	{"LANDING_TARIFFS_TITLE", "tariffs_title", 120},
	{"LANDING_TARIFFS_SUBTITLE", "tariffs_subtitle", 280},
	{"LANDING_FEATURES_TITLE", "features_title", 120},
	{"LANDING_FAQ_TITLE", "faq_title", 120},
	{"LANDING_FAQ_SUBTITLE", "faq_subtitle", 280},
	{"LANDING_CTA_TITLE", "cta_title", 120},
	{"LANDING_CTA_SUBTITLE", "cta_subtitle", 280},
}

// landingBoolFields — включатели блоков; все по умолчанию включены, чтобы после
// обновления лендинг выглядел как раньше.
var landingBoolFields = []struct {
	key  string
	json string
}{
	{"LANDING_SHOW_TARIFFS", "show_tariffs"},
	{"LANDING_SHOW_STEPS", "show_steps"},
	{"LANDING_SHOW_FEATURES", "show_features"},
	{"LANDING_SHOW_FAQ", "show_faq"},
	{"LANDING_SHOW_CTA", "show_cta"},
}

// LandingLayout — где стоит витрина тарифов; неизвестное значение — умолчание.
func LandingLayout() string {
	v := strings.ToLower(strings.TrimSpace(EffectiveEnv(LandingLayoutKey)))
	for _, l := range landingLayouts {
		if v == l {
			return v
		}
	}
	return LandingLayoutHeroSide
}

// LandingPublic — настройки лендинга для публичного bootstrap. Пустые тексты не
// отдаются: фронт в этом случае берёт перевод.
func LandingPublic() map[string]any {
	texts := make(map[string]string)
	for _, f := range landingTextFields {
		if v := strings.TrimSpace(EffectiveEnv(f.key)); v != "" {
			texts[f.json] = v
		}
	}
	out := map[string]any{
		"layout": LandingLayout(),
		"texts":  texts,
	}
	for _, f := range landingBoolFields {
		out[f.json] = cabinetBoolCurrentValue(f.key, true)
	}
	return out
}

// landingRegistry — группа «Лендинг» в «Настройках бота».
func landingRegistry() []SettingField {
	out := make([]SettingField, 0, len(landingTextFields)+len(landingBoolFields)+1)
	for _, f := range landingTextFields {
		out = append(out, SettingField{
			Key: f.key, Group: "landing", Type: SettingText,
			Apply:   applyBoundedText(f.key, f.maxRunes),
			Current: fortuneCurrent(f.key),
		})
	}
	out = append(out, SettingField{
		Key: LandingLayoutKey, Group: "landing", Type: SettingEnum, EnumValues: landingLayouts,
		Apply:   applyRuntimeEnum(LandingLayoutKey, landingLayouts),
		Current: enumCurrent(LandingLayoutKey, LandingLayoutHeroSide),
	})
	for _, f := range landingBoolFields {
		out = append(out, SettingField{
			Key: f.key, Group: "landing", Type: SettingBool, Instant: true,
			Apply:   applyFortuneBool(f.key),
			Current: cabinetBoolCurrent(f.key, true),
		})
	}
	return out
}
