package config

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// cabinetDecorThemeIDs — порядок опций в админке (синхрон с internal/cabinet/config.ValidDecorThemeIDs).
var cabinetDecorThemeIDs = []string{
	"off",
	"green",
	"pink",
	"orange",
	"yellow",
	"neon",
	"new_year",
	"summer",
	"halloween",
	"valentine",
	"spring",
	"black_friday",
}

func cabinetDecorThemeSet() map[string]struct{} {
	m := make(map[string]struct{}, len(cabinetDecorThemeIDs))
	for _, id := range cabinetDecorThemeIDs {
		m[id] = struct{}{}
	}
	return m
}
type SettingType string

const (
	SettingBool   SettingType = "bool"
	SettingInt    SettingType = "int"
	SettingFloat  SettingType = "float"
	SettingText   SettingType = "text"
	SettingURL    SettingType = "url"
	SettingEnum   SettingType = "enum"
	SettingCSVInt SettingType = "csv_int"
	SettingCSV    SettingType = "csv"
)

// SettingField — метаданные одного editable env-ключа (Phase 1 whitelist).
type SettingField struct {
	Key         string
	Group       string
	Type        SettingType
	EnumValues  []string
	MinInt      *int
	MaxInt      *int
	Instant     bool // bool toggles — autosave в UI
	Apply       func(value string) error
	Current     func() string
	Source      func() string // "env" | "db" | "default"
}

var remnaTagPattern = regexp.MustCompile(`^[A-Z0-9_]+$`)

// RuntimeSettingsRegistry — Phase 1 whitelist (~50 ключей).
func RuntimeSettingsRegistry() []SettingField {
	return []SettingField{
		// --- loyalty ---
		{
			Key: "LOYALTY_ENABLED", Group: "loyalty", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.loyaltyEnabled = v }),
			Current: func() string { return boolStr(conf.loyaltyEnabled) },
		},
		{
			Key: "LOYALTY_MAX_TOTAL_DISCOUNT_PERCENT", Group: "loyalty", Type: SettingInt,
			MinInt: intPtr(1), MaxInt: intPtr(100),
			Apply: applyIntField(func(v int) error {
				if v < 1 || v > 100 {
					return fmt.Errorf("must be 1–100")
				}
				conf.loyaltyMaxTotalDiscountPercent = v
				return nil
			}),
			Current: func() string { return strconv.Itoa(conf.loyaltyMaxTotalDiscountPercent) },
		},
		{
			Key: "RUB_PER_STAR", Group: "stars", Type: SettingFloat,
			Apply: applyFloatField(func(v float64) error {
				if v < 0 {
					return fmt.Errorf("must be >= 0")
				}
				conf.rubPerStar = v
				return nil
			}),
			Current: func() string {
				if conf.rubPerStar == 0 {
					return "0"
				}
				return strconv.FormatFloat(conf.rubPerStar, 'f', -1, 64)
			},
		},

		// --- payments_notify ---
		{
			Key: "PAYMENTS_NOTIFY_ENABLED", Group: "payments_notify", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.paymentsNotifyEnabled = v }),
			Current: func() string { return boolStr(conf.paymentsNotifyEnabled) },
		},
		{
			Key: "PAYMENTS_NOTIFY_CHAT_ID", Group: "payments_notify", Type: SettingText,
			Apply: applyInt64Field(func(v int64) error {
				if v < 0 {
					return fmt.Errorf("invalid chat id")
				}
				conf.paymentsNotifyChatID = v
				return nil
			}),
			Current: func() string { return strconv.FormatInt(conf.paymentsNotifyChatID, 10) },
		},
		{
			Key: "PAYMENTS_NOTIFY_MESSAGE_THREAD_ID", Group: "payments_notify", Type: SettingInt,
			Apply: applyIntField(func(v int) error {
				if v < 0 {
					return fmt.Errorf("must be >= 0")
				}
				conf.paymentsNotifyMessageThreadID = v
				return nil
			}),
			Current: func() string { return strconv.Itoa(conf.paymentsNotifyMessageThreadID) },
		},
		{
			Key: "PAYMENTS_NOTIFY_EVENTS", Group: "payments_notify", Type: SettingCSV,
			Apply: func(value string) error {
				applyPaymentsNotifyEvents(value)
				return nil
			},
			Current: paymentsNotifyEventsCurrent,
		},

		// --- trial ---
		{
			Key: "TRIAL_DAYS", Group: "trial", Type: SettingInt,
			MinInt: intPtr(1),
			Apply:  applyIntField(func(v int) error { conf.trialDays = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.trialDays) },
		},
		{
			Key: "TRIAL_TRAFFIC_LIMIT", Group: "trial", Type: SettingInt,
			MinInt: intPtr(1),
			Apply:  applyIntField(func(v int) error { conf.trialTrafficLimit = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.trialTrafficLimit) },
		},
		{
			Key: "TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY", Group: "trial", Type: SettingEnum,
			EnumValues: []string{"day", "week", "month", "month_rolling", "never"},
			Apply:      applyTrafficResetStrategy(func(v string) { conf.trialTrafficLimitResetStrategy = v }),
			Current:    func() string { return conf.trialTrafficLimitResetStrategy },
		},
		{
			Key: "TRIAL_ADD_TO_PAID", Group: "trial", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.trialAddsToPaid = v }),
			Current: func() string { return boolStr(conf.trialAddsToPaid) },
		},
		{
			Key: "TRAFFIC_LIMIT_RESET_STRATEGY", Group: "trial", Type: SettingEnum,
			EnumValues: []string{"day", "week", "month", "month_rolling", "never"},
			Apply:      applyTrafficResetStrategy(func(v string) { conf.trafficLimitResetStrategy = v }),
			Current:    func() string { return conf.trafficLimitResetStrategy },
		},

		// --- tags ---
		{
			Key: "REMNAWAVE_TAG", Group: "tags", Type: SettingText,
			Apply: applyRemnaTag(func(v string) { conf.remnawaveTag = v }),
			Current: func() string { return conf.remnawaveTag },
		},
		{
			Key: "TRIAL_REMNAWAVE_TAG", Group: "tags", Type: SettingText,
			Apply: applyRemnaTagOptional(func(v string) { conf.trialRemnawaveTag = v }),
			Current: func() string { return conf.trialRemnawaveTag },
		},

		// --- hwid ---
		{
			Key: "HWID_EXTRA_DEVICES_ENABLED", Group: "hwid", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.hwidExtraDevicesEnabled = v }),
			Current: func() string { return boolStr(conf.hwidExtraDevicesEnabled) },
		},
		{
			Key: "HWID_ADD_PRICE", Group: "hwid", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.hwidAddPrice = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.hwidAddPrice) },
		},
		{
			Key: "HWID_ADD_STARS_PRICE", Group: "hwid", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.hwidAddStarsPrice = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.hwidAddStarsPrice) },
		},
		{
			Key: "HWID_MAX_DEVICE", Group: "hwid", Type: SettingInt,
			MinInt: intPtr(1),
			Apply:  applyIntField(func(v int) error { conf.hwidMaxDevices = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.hwidMaxDevices) },
		},
		{
			Key: "TRIAL_HWID_LIMIT", Group: "hwid", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.trialHwidLimit = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.trialHwidLimit) },
		},
		{
			Key: "PAID_HWID_LIMIT", Group: "hwid", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.paidHwidLimit = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.paidHwidLimit) },
		},
		{
			Key: "HWID_FALLBACK_DEVICE_LIMIT", Group: "hwid", Type: SettingInt,
			MinInt: intPtr(1),
			Apply:  applyIntField(func(v int) error { conf.hwidFallbackDeviceLimit = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.hwidFallbackDeviceLimit) },
		},

		// --- referral (progressive only; REFERRAL_MODE / REFERRAL_DAYS — только .env) ---
		{
			Key: "REFERRAL_FIRST_REFERRER_DAYS", Group: "referral", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.referralFirstReferrerDays = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.referralFirstReferrerDays) },
		},
		{
			Key: "REFERRAL_FIRST_REFEREE_DAYS", Group: "referral", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.referralFirstRefereeDays = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.referralFirstRefereeDays) },
		},
		{
			Key: "REFERRAL_REPEAT_REFERRER_DAYS", Group: "referral", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.referralRepeatReferrerDays = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.referralRepeatReferrerDays) },
		},

		// --- access ---
		{
			Key: "FORWARD_USER_MESSAGES_TO_ADMIN", Group: "access", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.forwardUserMessagesToAdmin = v }),
			Current: func() string { return boolStr(conf.forwardUserMessagesToAdmin) },
		},
		{
			Key: "BLOCKED_TELEGRAM_IDS", Group: "access", Type: SettingCSVInt,
			Apply: func(value string) error {
				m, err := parseTelegramIDList(value)
				if err != nil {
					return err
				}
				conf.blockedTelegramIds = m
				return nil
			},
			Current: func() string { return formatTelegramIDList(conf.blockedTelegramIds) },
		},
		{
			Key: "WHITELISTED_TELEGRAM_IDS", Group: "access", Type: SettingCSVInt,
			Apply: func(value string) error {
				m, err := parseTelegramIDList(value)
				if err != nil {
					return err
				}
				conf.whitelistedTelegramIds = m
				return nil
			},
			Current: func() string { return formatTelegramIDList(conf.whitelistedTelegramIds) },
		},

		// --- cabinet (оформление SPA) ---
		{
			Key: "CABINET_LIGHT_THEME_ENABLED", Group: "cabinet", Type: SettingBool, Instant: true,
			Apply:   applyFortuneBool("CABINET_LIGHT_THEME_ENABLED"),
			Current: cabinetLightThemeCurrent(),
		},
		{
			Key: "CABINET_DECOR_THEME", Group: "cabinet", Type: SettingEnum, Instant: true,
			EnumValues: cabinetDecorThemeIDs,
			Apply:      applyCabinetDecorTheme(),
			Current:    cabinetDecorThemeCurrent(),
		},

		// --- tariffs (витрина кабинета, режим sales tariffs) ---
		{
			Key: "CABINET_TARIFF_PRICE_DISPLAY", Group: "tariffs", Type: SettingEnum, Instant: true,
			EnumValues: []string{"monthly", "marketing"},
			Apply:      applyCabinetTariffPriceDisplay(),
			Current:    cabinetTariffPriceDisplayCurrent(),
		},

		// --- lifecycle (без cron / master toggle) ---
		{
			Key: "LIFECYCLE_NO_CONNECT_PAID_ENABLED", Group: "lifecycle", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.lifecycleNoConnectPaidEnabled = v }),
			Current: func() string { return boolStr(conf.lifecycleNoConnectPaidEnabled) },
		},
		{
			Key: "LIFECYCLE_NO_CONNECT_TRIAL_ENABLED", Group: "lifecycle", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.lifecycleNoConnectTrialEnabled = v }),
			Current: func() string { return boolStr(conf.lifecycleNoConnectTrialEnabled) },
		},
		{
			Key: "LIFECYCLE_NO_CONNECT_DELAY_HOURS", Group: "lifecycle", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.lifecycleNoConnectDelayHours = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.lifecycleNoConnectDelayHours) },
		},
		{
			Key: "LIFECYCLE_NO_CONNECT_MAX_AGE_HOURS", Group: "lifecycle", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.lifecycleNoConnectMaxAgeHours = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.lifecycleNoConnectMaxAgeHours) },
		},
		{
			Key: "LIFECYCLE_WINBACK_ENABLED", Group: "lifecycle", Type: SettingBool, Instant: true,
			Apply:  applyBoolField(func(v bool) { conf.lifecycleWinbackEnabled = v }),
			Current: func() string { return boolStr(conf.lifecycleWinbackEnabled) },
		},
		{
			Key: "LIFECYCLE_WINBACK_DAYS_AFTER_EXPIRY", Group: "lifecycle", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.lifecycleWinbackDaysAfterExpiry = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.lifecycleWinbackDaysAfterExpiry) },
		},
		{
			Key: "LIFECYCLE_WINBACK_DISCOUNT_PERCENT", Group: "lifecycle", Type: SettingInt,
			MinInt: intPtr(0), MaxInt: intPtr(100),
			Apply: applyIntField(func(v int) error {
				if v < 0 || v > 100 {
					return fmt.Errorf("must be 0–100")
				}
				conf.lifecycleWinbackDiscountPercent = v
				return nil
			}),
			Current: func() string { return strconv.Itoa(conf.lifecycleWinbackDiscountPercent) },
		},
		{
			Key: "LIFECYCLE_WINBACK_DISCOUNT_TTL_HOURS", Group: "lifecycle", Type: SettingInt,
			MinInt: intPtr(0),
			Apply:  applyIntField(func(v int) error { conf.lifecycleWinbackDiscountTTLHours = v; return nil }),
			Current: func() string { return strconv.Itoa(conf.lifecycleWinbackDiscountTTLHours) },
		},
		{
			Key: "LIFECYCLE_VIDEO_GUIDE_URL", Group: "lifecycle", Type: SettingURL,
			Apply:  applyStringField(func(v string) { conf.lifecycleVideoGuideURL = v }),
			Current: func() string { return conf.lifecycleVideoGuideURL },
		},
		{
			Key: "LIFECYCLE_SUPPORT_CONTACT", Group: "lifecycle", Type: SettingText,
			Apply:  applyStringField(func(v string) { conf.lifecycleSupportContact = v }),
			Current: func() string { return conf.lifecycleSupportContact },
		},

		// --- links ---
		{Key: "CHANNEL_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.channelURL = v }), Current: func() string { return conf.channelURL }},
		{Key: "TOS_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.tosURL = v }), Current: func() string { return conf.tosURL }},
		{Key: "SERVER_SELECTION_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.serverSelectionURL = v }), Current: func() string { return conf.serverSelectionURL }},
		{Key: "PUBLIC_OFFER_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.publicOfferURL = v }), Current: func() string { return conf.publicOfferURL }},
		{Key: "PRIVACY_POLICY_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.privacyPolicyURL = v }), Current: func() string { return conf.privacyPolicyURL }},
		{Key: "TERMS_OF_SERVICE_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.termsOfServiceURL = v }), Current: func() string { return conf.termsOfServiceURL }},
		{Key: "VIDEO_GUIDE_URL", Group: "links", Type: SettingURL, Apply: applyStringField(func(v string) { conf.videoGuideURL = v }), Current: func() string { return conf.videoGuideURL }},

		// --- fortune ---
		{Key: "FORTUNE_ENABLED", Group: "fortune", Type: SettingBool, Instant: true, Apply: applyFortuneBool("FORTUNE_ENABLED"), Current: fortuneCurrent("FORTUNE_ENABLED")},
		{Key: "FORTUNE_DAILY_FREE_SPIN", Group: "fortune", Type: SettingBool, Instant: true, Apply: applyFortuneBool("FORTUNE_DAILY_FREE_SPIN"), Current: fortuneCurrent("FORTUNE_DAILY_FREE_SPIN")},
		{Key: "FORTUNE_WINNER_TICKER_ENABLED", Group: "fortune", Type: SettingBool, Instant: true, Apply: applyFortuneBool("FORTUNE_WINNER_TICKER_ENABLED"), Current: fortuneCurrent("FORTUNE_WINNER_TICKER_ENABLED")},
		{Key: "FORTUNE_WINNER_TICKER_FAKE_FILL", Group: "fortune", Type: SettingBool, Instant: true, Apply: applyFortuneBool("FORTUNE_WINNER_TICKER_FAKE_FILL"), Current: fortuneCurrent("FORTUNE_WINNER_TICKER_FAKE_FILL")},
		{Key: "FORTUNE_MAX_SPINS_PER_DAY", Group: "fortune", Type: SettingInt, MinInt: intPtr(1), Apply: applyFortuneInt("FORTUNE_MAX_SPINS_PER_DAY", 1), Current: fortuneCurrent("FORTUNE_MAX_SPINS_PER_DAY")},
		{Key: "FORTUNE_MIN_SUBSCRIPTION_DAYS", Group: "fortune", Type: SettingInt, MinInt: intPtr(1), Apply: applyFortuneInt("FORTUNE_MIN_SUBSCRIPTION_DAYS", 1), Current: fortuneCurrent("FORTUNE_MIN_SUBSCRIPTION_DAYS")},
		{Key: "FORTUNE_SPIN_COST_DAYS", Group: "fortune", Type: SettingInt, MinInt: intPtr(1), Apply: applyFortuneInt("FORTUNE_SPIN_COST_DAYS", 1), Current: fortuneCurrent("FORTUNE_SPIN_COST_DAYS")},
		{Key: "FORTUNE_WEIGHT_MICRO", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_MICRO", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_MICRO")},
		{Key: "FORTUNE_WEIGHT_XP", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_XP", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_XP")},
		{Key: "FORTUNE_WEIGHT_DISCOUNT_3", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DISCOUNT_3", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DISCOUNT_3")},
		{Key: "FORTUNE_WEIGHT_DAYS_3", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DAYS_3", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DAYS_3")},
		{Key: "FORTUNE_WEIGHT_DISCOUNT_5", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DISCOUNT_5", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DISCOUNT_5")},
		{Key: "FORTUNE_WEIGHT_DAYS_5", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DAYS_5", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DAYS_5")},
		{Key: "FORTUNE_WEIGHT_DAYS_7", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DAYS_7", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DAYS_7")},
		{Key: "FORTUNE_WEIGHT_DAYS_15", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DAYS_15", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DAYS_15")},
		{Key: "FORTUNE_WEIGHT_DAYS_30", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DAYS_30", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DAYS_30")},
		{Key: "FORTUNE_WEIGHT_DAYS_180", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_WEIGHT_DAYS_180", 0), Current: fortuneCurrent("FORTUNE_WEIGHT_DAYS_180")},
		{Key: "FORTUNE_REWARD_XP_AMOUNT", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_XP_AMOUNT", 0), Current: fortuneCurrent("FORTUNE_REWARD_XP_AMOUNT")},
		{Key: "FORTUNE_REWARD_MICRO_XP_MIN", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_MICRO_XP_MIN", 0), Current: fortuneCurrent("FORTUNE_REWARD_MICRO_XP_MIN")},
		{Key: "FORTUNE_REWARD_MICRO_XP_MAX", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_MICRO_XP_MAX", 0), Current: fortuneCurrent("FORTUNE_REWARD_MICRO_XP_MAX")},
		{Key: "FORTUNE_REWARD_DISCOUNT_3_PERCENT", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DISCOUNT_3_PERCENT", 0), Current: fortuneCurrent("FORTUNE_REWARD_DISCOUNT_3_PERCENT")},
		{Key: "FORTUNE_REWARD_DISCOUNT_5_PERCENT", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DISCOUNT_5_PERCENT", 0), Current: fortuneCurrent("FORTUNE_REWARD_DISCOUNT_5_PERCENT")},
		{Key: "FORTUNE_REWARD_DAYS_3", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DAYS_3", 0), Current: fortuneCurrent("FORTUNE_REWARD_DAYS_3")},
		{Key: "FORTUNE_REWARD_DAYS_5", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DAYS_5", 0), Current: fortuneCurrent("FORTUNE_REWARD_DAYS_5")},
		{Key: "FORTUNE_REWARD_DAYS_7", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DAYS_7", 0), Current: fortuneCurrent("FORTUNE_REWARD_DAYS_7")},
		{Key: "FORTUNE_REWARD_DAYS_15", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DAYS_15", 0), Current: fortuneCurrent("FORTUNE_REWARD_DAYS_15")},
		{Key: "FORTUNE_REWARD_DAYS_30", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DAYS_30", 0), Current: fortuneCurrent("FORTUNE_REWARD_DAYS_30")},
		{Key: "FORTUNE_REWARD_DAYS_180", Group: "fortune", Type: SettingInt, MinInt: intPtr(0), Apply: applyFortuneInt("FORTUNE_REWARD_DAYS_180", 0), Current: fortuneCurrent("FORTUNE_REWARD_DAYS_180")},
	}
}

func runtimeSettingsByKey() map[string]SettingField {
	out := make(map[string]SettingField, len(RuntimeSettingsRegistry()))
	for _, f := range RuntimeSettingsRegistry() {
		out[f.Key] = f
	}
	return out
}

func boolStr(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

func intPtr(v int) *int { return &v }

func applyBoolField(set func(bool)) func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(strings.ToLower(value))
		if v != "true" && v != "false" {
			return fmt.Errorf("must be true or false")
		}
		set(v == "true")
		return nil
	}
}

func applyIntField(set func(int) error) func(string) error {
	return func(value string) error {
		v, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return fmt.Errorf("invalid integer")
		}
		return set(v)
	}
}

func applyInt64Field(set func(int64) error) func(string) error {
	return func(value string) error {
		s := strings.TrimSpace(value)
		if s == "" {
			return set(0)
		}
		v, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid integer")
		}
		return set(v)
	}
}

func applyFloatField(set func(float64) error) func(string) error {
	return func(value string) error {
		v, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return fmt.Errorf("invalid number")
		}
		return set(v)
	}
}

func applyStringField(set func(string)) func(string) error {
	return func(value string) error {
		set(strings.TrimSpace(value))
		return nil
	}
}

func applyEnumField(allowed []string, set func(string)) func(string) error {
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, a := range allowed {
		allowedSet[strings.ToLower(a)] = struct{}{}
	}
	return func(value string) error {
		v := strings.ToLower(strings.TrimSpace(value))
		if _, ok := allowedSet[v]; !ok {
			return fmt.Errorf("invalid value")
		}
		set(v)
		return nil
	}
}

func applyTrafficResetStrategy(set func(string)) func(string) error {
	return applyEnumField([]string{"day", "week", "month", "month_rolling", "never"}, set)
}

func applyRemnaTag(set func(string)) func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(value)
		if v == "" {
			return fmt.Errorf("required")
		}
		if !remnaTagPattern.MatchString(v) {
			return fmt.Errorf("format: ^[A-Z0-9_]+$")
		}
		set(v)
		return nil
	}
}

func applyRemnaTagOptional(set func(string)) func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(value)
		if v != "" && !remnaTagPattern.MatchString(v) {
			return fmt.Errorf("format: ^[A-Z0-9_]+$")
		}
		set(v)
		return nil
	}
}

func applyPaymentsNotifyEvents(value string) {
	conf.paymentsNotifySendPaid = false
	conf.paymentsNotifySendCancel = false
	s := strings.TrimSpace(value)
	if s == "" {
		conf.paymentsNotifySendPaid = true
		conf.paymentsNotifySendCancel = true
		return
	}
	for _, p := range strings.Split(s, ",") {
		switch strings.ToLower(strings.TrimSpace(p)) {
		case "paid":
			conf.paymentsNotifySendPaid = true
		case "cancel":
			conf.paymentsNotifySendCancel = true
		}
	}
}

func paymentsNotifyEventsCurrent() string {
	var parts []string
	if conf.paymentsNotifySendPaid {
		parts = append(parts, "paid")
	}
	if conf.paymentsNotifySendCancel {
		parts = append(parts, "cancel")
	}
	return strings.Join(parts, ",")
}

func parseTelegramIDList(value string) (map[int64]bool, error) {
	s := strings.TrimSpace(value)
	if s == "" {
		return map[int64]bool{}, nil
	}
	out := make(map[int64]bool)
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := strconv.ParseInt(part, 10, 64)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("invalid telegram id: %s", part)
		}
		out[id] = true
	}
	return out, nil
}

func formatTelegramIDList(m map[int64]bool) string {
	if len(m) == 0 {
		return ""
	}
	ids := make([]string, 0, len(m))
	for id := range m {
		ids = append(ids, strconv.FormatInt(id, 10))
	}
	return strings.Join(ids, ",")
}

func applyFortuneBool(key string) func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(strings.ToLower(value))
		if v != "true" && v != "false" {
			return fmt.Errorf("must be true or false")
		}
		setRuntimeOverride(key, v)
		return nil
	}
}

func applyFortuneInt(key string, min int) func(string) error {
	return func(value string) error {
		v, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil {
			return fmt.Errorf("invalid integer")
		}
		if v < min {
			return fmt.Errorf("must be >= %d", min)
		}
		setRuntimeOverride(key, strconv.Itoa(v))
		return nil
	}
}

func fortuneCurrent(key string) func() string {
	return func() string { return effectiveEnvUnderRLock(key) }
}

func cabinetLightThemeCurrent() func() string {
	return func() string {
		v := strings.TrimSpace(effectiveEnvUnderRLock("CABINET_LIGHT_THEME_ENABLED"))
		if v == "" {
			return "true"
		}
		return v
	}
}

func applyCabinetDecorTheme() func(string) error {
	allowed := cabinetDecorThemeSet()
	return func(value string) error {
		v := strings.TrimSpace(strings.ToLower(value))
		if _, ok := allowed[v]; !ok {
			return fmt.Errorf("invalid decor theme %q", value)
		}
		setRuntimeOverride("CABINET_DECOR_THEME", v)
		return nil
	}
}

func cabinetDecorThemeCurrent() func() string {
	allowed := cabinetDecorThemeSet()
	return func() string {
		v := strings.TrimSpace(strings.ToLower(effectiveEnvUnderRLock("CABINET_DECOR_THEME")))
		if v == "" {
			return "off"
		}
		if _, ok := allowed[v]; ok {
			return v
		}
		return "off"
	}
}

func applyCabinetTariffPriceDisplay() func(string) error {
	return func(value string) error {
		v := strings.TrimSpace(strings.ToLower(value))
		if v != "monthly" && v != "marketing" {
			return fmt.Errorf("invalid tariff price display %q", value)
		}
		setRuntimeOverride("CABINET_TARIFF_PRICE_DISPLAY", v)
		return nil
	}
}

func cabinetTariffPriceDisplayCurrent() func() string {
	return func() string {
		v := strings.TrimSpace(strings.ToLower(effectiveEnvUnderRLock("CABINET_TARIFF_PRICE_DISPLAY")))
		if v == "marketing" {
			return "marketing"
		}
		return "monthly"
	}
}
