package config

import (
	"fmt"
	"strconv"
	"strings"
)

// Оповещения админу: куда бот пишет о сбоях и событиях, которые касаются
// только админа. Общий чат (обычно супергруппа с темами) и у каждого вида
// своя тема; при желании виду можно задать отдельный чат. Пустой общий чат —
// личка ADMIN_TELEGRAM_ID, как было до этих настроек.
//
// Оплаты и партнёрка пока живут на своих ключах (PAYMENTS_NOTIFY_*,
// PARTNER_NOTIFY_*), их перенос — следующий шаг.

// Виды оповещений. Значения уходят в API админки и в ключи настроек.
const (
	AdminAlertSystem  = "system"
	AdminAlertServers = "servers"
	AdminAlertInfra   = "infra"
)

// AdminAlertsChatKey — общий чат для всех видов.
const AdminAlertsChatKey = "ADMIN_ALERTS_CHAT_ID"

type adminAlertSetting struct {
	kind   string
	prefix string
}

// adminAlertSettings — порядок здесь — порядок строк в админке.
var adminAlertSettings = []adminAlertSetting{
	{AdminAlertSystem, "ADMIN_ALERT_SYSTEM"},
	{AdminAlertServers, "ADMIN_ALERT_SERVERS"},
	{AdminAlertInfra, "ADMIN_ALERT_INFRA"},
}

// AdminAlertKinds — все виды в порядке экрана.
func AdminAlertKinds() []string {
	out := make([]string, 0, len(adminAlertSettings))
	for _, s := range adminAlertSettings {
		out = append(out, s.kind)
	}
	return out
}

// AdminAlertSettings — как настроен вид: включён ли, свой чат (0 — общий) и тема.
// ok=false — вида нет.
func AdminAlertSettings(kind string) (enabled bool, chatID int64, threadID int, ok bool) {
	for _, s := range adminAlertSettings {
		if s.kind != kind {
			continue
		}
		return cabinetBoolCurrentValue(s.prefix+"_ENABLED", true),
			envInt64(s.prefix + "_CHAT_ID"),
			int(envInt64(s.prefix + "_THREAD_ID")),
			true
	}
	return false, 0, 0, false
}

// AdminAlertsChatID — общий чат; 0 — личка админу.
func AdminAlertsChatID() int64 {
	return envInt64(AdminAlertsChatKey)
}

func envInt64(key string) int64 {
	v, err := strconv.ParseInt(strings.TrimSpace(EffectiveEnv(key)), 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// applyChatID — id чата Telegram. Знак не проверяем: у супергрупп он
// отрицательный (-1001234567890). Пусто или 0 — «не задан».
func applyChatID(key string) func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(value)
		if v == "" || v == "0" {
			setRuntimeOverride(key, "")
			return nil
		}
		if _, err := strconv.ParseInt(v, 10, 64); err != nil {
			return fmt.Errorf("invalid chat id")
		}
		setRuntimeOverride(key, v)
		return nil
	}
}

// applyThreadID — номер темы форума; пусто или 0 — основной чат.
func applyThreadID(key string) func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(value)
		if v == "" {
			setRuntimeOverride(key, "")
			return nil
		}
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			return fmt.Errorf("must be >= 0")
		}
		if n == 0 {
			setRuntimeOverride(key, "")
			return nil
		}
		setRuntimeOverride(key, strconv.Itoa(n))
		return nil
	}
}

// adminAlertsRegistry — группа «Оповещения админу» в админке.
func adminAlertsRegistry() []SettingField {
	out := []SettingField{{
		Key: AdminAlertsChatKey, Group: "admin_alerts", Type: SettingText,
		Apply:   applyChatID(AdminAlertsChatKey),
		Current: fortuneCurrent(AdminAlertsChatKey),
	}}
	for _, s := range adminAlertSettings {
		out = append(out,
			SettingField{
				Key: s.prefix + "_ENABLED", Group: "admin_alerts", Type: SettingBool, Instant: true,
				Apply:   applyFortuneBool(s.prefix + "_ENABLED"),
				Current: cabinetBoolCurrent(s.prefix+"_ENABLED", true),
			},
			SettingField{
				Key: s.prefix + "_CHAT_ID", Group: "admin_alerts", Type: SettingText,
				Apply:   applyChatID(s.prefix + "_CHAT_ID"),
				Current: fortuneCurrent(s.prefix + "_CHAT_ID"),
			},
			SettingField{
				Key: s.prefix + "_THREAD_ID", Group: "admin_alerts", Type: SettingText,
				Apply:   applyThreadID(s.prefix + "_THREAD_ID"),
				Current: fortuneCurrent(s.prefix + "_THREAD_ID"),
			},
		)
	}
	return out
}
