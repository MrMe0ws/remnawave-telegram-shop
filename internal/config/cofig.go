package config

import (
	"fmt"
	"log"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

type config struct {
	telegramToken                                                                string
	price1, price3, price6, price12                                              int
	starsPrice1, starsPrice3, starsPrice6, starsPrice12                          int
	remnawaveUrl, remnawaveToken, remnawaveMode, remnawaveTag                    string
	defaultLanguage                                                              string
	databaseURL                                                                  string
	cryptoPayURL, cryptoPayToken                                                 string
	botURL                                                                       string
	yookasaURL, yookasaShopId, yookasaSecretKey, yookasaEmail, yookasaWebhookURL string
	plategaMerchantID, plategaSecret, plategaWebhookURL                          string
	isPlategaSBPEnabled, isPlategaCardsEnabled                                   bool
	isPlategaAcquiringEnabled, isPlategaWorldwideEnabled                         bool
	isPlategaCryptoEnabled                                                       bool
	moynalogURL, moynalogUsername, moynalogPassword                              string
	moynalogProxyURL                                                             string
	telegramProxyURL                                                             string
	trafficLimit, trialTrafficLimit                                              int
	feedbackURL                                                                  string
	channelURL                                                                   string
	serverStatusURL                                                              string
	supportURL                                                                   string
	tosURL                                                                       string
	videoGuideURL                                                                string
	serverSelectionURL                                                           string
	publicOfferURL                                                               string
	privacyPolicyURL                                                             string
	termsOfServiceURL                                                            string
	greetingImage                                                                string
	isYookasaEnabled                                                             bool
	isCryptoEnabled                                                              bool
	isTelegramStarsEnabled                                                       bool
	isMoynalogEnabled                                                            bool
	moynalogReceiptYookasa, moynalogReceiptPlatega, moynalogReceiptCrypto        bool // MOYNALOG_RECEIPT_FOR
	adminTelegramId                                                              int64
	forwardUserMessagesToAdmin                                                   bool
	trialDays                                                                    int
	squadUUIDs                                                                   map[uuid.UUID]uuid.UUID
	referralDays                                                                 int
	referralMode                                                                 string
	referralFirstReferrerDays                                                    int
	referralFirstRefereeDays                                                     int
	referralRepeatReferrerDays                                                   int
	trialAddsToPaid                                                              bool
	hwidAddPrice                                                                 int
	hwidAddStarsPrice                                                            int
	hwidMaxDevices                                                               int
	trialHwidLimit                                                               int
	paidHwidLimit                                                                int
	hwidExtraDevicesEnabled                                                      bool
	miniApp                                                                      string
	enableAutoPayment                                                            bool
	healthCheckPort                                                              int
	tributeWebhookUrl, tributeAPIKey, tributePaymentUrl                          string
	isWebAppLinkEnabled                                                          bool
	daysInMonth                                                                  int
	externalSquadUUID                                                            uuid.UUID
	hwidFallbackDeviceLimit                                                      int
	trialTrafficLimitResetStrategy                                               string
	blockedTelegramIds                                                           map[int64]bool
	whitelistedTelegramIds                                                       map[int64]bool
	requirePaidPurchaseForStars                                                  bool
	trialInternalSquads                                                          map[uuid.UUID]uuid.UUID
	trialExternalSquadUUID                                                       uuid.UUID
	trialRemnawaveTag                                                            string
	remnawaveHeaders                                                             map[string]string
	trafficLimitResetStrategy                                                    string
	salesMode                                                                    string
	showLongTermSavingsPercent                                                   bool    // подписи кнопок периодов: (-N%) к 3/6/12 мес относительно цены 1 мес
	rubPerStar                                                                   float64 // рублей за 1 Star; 0 = не задано (подсказка Stars в админке отключена)
	loyaltyEnabled                                                               bool
	loyaltyMaxTotalDiscountPercent                                               int   // потолок суммы лояльность+промо (1–100)
	loyaltyXPMinPerPurchase                                                      int64 // минимум XP за оплату если сумма не дала XP
	paymentsNotifyEnabled                                                        bool
	paymentsNotifyChatID                                                         int64
	paymentsNotifyMessageThreadID                                                int
	paymentsNotifySendPaid                                                       bool
	paymentsNotifySendCancel                                                     bool
	lifecycleNotifyEnabled                                                       bool
	lifecycleCron                                                                string
	lifecycleNoConnectPaidEnabled                                                bool
	lifecycleNoConnectTrialEnabled                                               bool
	lifecycleNoConnectDelayHours                                                 int
	lifecycleNoConnectMaxAgeHours                                                int
	lifecycleWinbackEnabled                                                      bool
	lifecycleWinbackDaysAfterExpiry                                              int
	lifecycleWinbackDiscountPercent                                              int
	lifecycleWinbackDiscountTTLHours                                             int
	lifecycleVideoGuideURL                                                       string
	lifecycleSupportContact                                                      string
}

var conf config

func RemnawaveTag() string {
	return conf.remnawaveTag
}

func TrialRemnawaveTag() string {
	if conf.trialRemnawaveTag != "" {
		return conf.trialRemnawaveTag
	}
	return conf.remnawaveTag
}

func DefaultLanguage() string {
	return conf.defaultLanguage
}
func GetTributeWebHookUrl() string {
	return conf.tributeWebhookUrl
}
func GetTributeAPIKey() string {
	return conf.tributeAPIKey
}

func GetTributePaymentUrl() string {
	return conf.tributePaymentUrl
}

// GetYookasaWebHookURL — путь или полный URL вебхука YooKassa; пусто = использовать только поллинг.
func GetYookasaWebHookURL() string {
	return conf.yookasaWebhookURL
}

func PlategaMerchantID() string {
	return conf.plategaMerchantID
}

func PlategaSecret() string {
	return conf.plategaSecret
}

// GetPlategaWebHookURL — путь для mux (как TRIBUTE); пусто = только поллинг Platega.
func GetPlategaWebHookURL() string {
	return conf.plategaWebhookURL
}

func IsPlategaSBPEnabled() bool {
	return conf.isPlategaSBPEnabled
}

func IsPlategaCardsEnabled() bool {
	return conf.isPlategaCardsEnabled
}

func IsPlategaAcquiringEnabled() bool {
	return conf.isPlategaAcquiringEnabled
}

func IsPlategaWorldwideEnabled() bool {
	return conf.isPlategaWorldwideEnabled
}

func IsPlategaCryptoEnabled() bool {
	return conf.isPlategaCryptoEnabled
}

// IsPlategaEnabled — true, если включён хотя бы один метод Platega (и PLATEGA_ENABLED в env).
func IsPlategaEnabled() bool {
	return conf.isPlategaSBPEnabled || conf.isPlategaCardsEnabled ||
		conf.isPlategaAcquiringEnabled || conf.isPlategaWorldwideEnabled ||
		conf.isPlategaCryptoEnabled
}

func GetHwidFallbackDeviceLimit() int {
	return conf.hwidFallbackDeviceLimit
}

func GetReferralDays() int {
	return conf.referralDays
}

func ReferralMode() string {
	return conf.referralMode
}

func ReferralFirstReferrerDays() int {
	return conf.referralFirstReferrerDays
}

func ReferralFirstRefereeDays() int {
	return conf.referralFirstRefereeDays
}

func ReferralRepeatReferrerDays() int {
	return conf.referralRepeatReferrerDays
}

func TrialAddsToPaid() bool {
	return conf.trialAddsToPaid
}

func HwidAddPrice() int {
	return conf.hwidAddPrice
}

func HwidAddStarsPrice() int {
	return conf.hwidAddStarsPrice
}

func HwidMaxDevices() int {
	return conf.hwidMaxDevices
}

// HwidExtraDevicesEnabled — продажа доп. HWID-слотов (кнопки, счета с extra, отдельная оплата HWID). false не трогает уже выданные слоты в БД/Remnawave.
func HwidExtraDevicesEnabled() bool {
	return conf.hwidExtraDevicesEnabled
}

func TrialHwidLimit() int {
	return conf.trialHwidLimit
}

func PaidHwidLimit() int {
	return conf.paidHwidLimit
}

func GetMiniAppURL() string {
	return conf.miniApp
}

func SquadUUIDs() map[uuid.UUID]uuid.UUID {
	return conf.squadUUIDs
}

func GetBlockedTelegramIds() map[int64]bool {
	return conf.blockedTelegramIds
}

func GetWhitelistedTelegramIds() map[int64]bool {
	return conf.whitelistedTelegramIds
}

func TrialInternalSquads() map[uuid.UUID]uuid.UUID {
	if len(conf.trialInternalSquads) > 0 {
		return conf.trialInternalSquads
	}
	return conf.squadUUIDs
}

func TrialExternalSquadUUID() uuid.UUID {
	if conf.trialExternalSquadUUID != uuid.Nil {
		return conf.trialExternalSquadUUID
	}
	return conf.externalSquadUUID
}

func TrialTrafficLimit() int {
	return conf.trialTrafficLimit * bytesInGigabyte
}

func TrialDays() int {
	return conf.trialDays
}

func TrialTrafficLimitResetStrategy() string {
	return conf.trialTrafficLimitResetStrategy
}

func TrafficLimitResetStrategy() string {
	return conf.trafficLimitResetStrategy
}

// SalesMode: "classic" (цены из env) или "tariffs" (цены из БД).
func SalesMode() string {
	return conf.salesMode
}

// ShowLongTermSavingsPercent — добавлять к кнопкам 3/6/12 мес экономию в % относительно покупки по месячной цене (PRICE_1 или цена 1 мес тарифа).
func ShowLongTermSavingsPercent() bool {
	return conf.showLongTermSavingsPercent
}

// RubPerStar — сколько рублей стоит 1 Telegram Star (для подсказки в админке тарифов и опциональной конвертации). 0 = не использовать.
func RubPerStar() float64 {
	return conf.rubPerStar
}

// LoyaltyEnabled — система лояльности (XP, скидки по уровням).
func LoyaltyEnabled() bool {
	return conf.loyaltyEnabled
}

// LoyaltyMaxTotalDiscountPercent — верхняя граница суммы процентов лояльность + промо (по умолчанию 100).
func LoyaltyMaxTotalDiscountPercent() int {
	return conf.loyaltyMaxTotalDiscountPercent
}

// LoyaltyXPMinPerPaidPurchase — минимальный XP за успешную покупку, если сумма не дала XP (LOYALTY_XP_MIN_PER_PURCHASE).
func LoyaltyXPMinPerPaidPurchase() int64 {
	return conf.loyaltyXPMinPerPurchase
}

func FeedbackURL() string {
	return conf.feedbackURL
}

func ChannelURL() string {
	return conf.channelURL
}

func ServerStatusURL() string {
	return conf.serverStatusURL
}

func SupportURL() string {
	return conf.supportURL
}

func TosURL() string {
	return conf.tosURL
}

func VideoGuideURL() string {
	return conf.videoGuideURL
}

func ServerSelectionURL() string {
	return conf.serverSelectionURL
}

func PublicOfferURL() string {
	return conf.publicOfferURL
}

func PrivacyPolicyURL() string {
	return conf.privacyPolicyURL
}

func TermsOfServiceURL() string {
	return conf.termsOfServiceURL
}

func GreetingImage() string {
	return strings.TrimSpace(conf.greetingImage)
}

func YookasaEmail() string {
	return conf.yookasaEmail
}

func Price1() int {
	return conf.price1
}

func Price3() int {
	return conf.price3
}

func Price6() int {
	return conf.price6
}

func Price12() int {
	return conf.price12
}

func DaysInMonth() int {
	return conf.daysInMonth
}

func ExternalSquadUUID() uuid.UUID {
	return conf.externalSquadUUID
}

func Price(month int) int {
	switch month {
	case 1:
		return conf.price1
	case 3:
		return conf.price3
	case 6:
		return conf.price6
	case 12:
		return conf.price12
	default:
		return conf.price1
	}
}

func StarsPrice(month int) int {
	switch month {
	case 1:
		return conf.starsPrice1
	case 3:
		return conf.starsPrice3
	case 6:
		return conf.starsPrice6
	case 12:
		return conf.starsPrice12
	default:
		return conf.starsPrice1
	}
}
func TelegramToken() string {
	return conf.telegramToken
}
func RemnawaveUrl() string {
	return conf.remnawaveUrl
}
func DadaBaseUrl() string {
	return conf.databaseURL
}
func RemnawaveToken() string {
	return conf.remnawaveToken
}
func RemnawaveMode() string {
	return conf.remnawaveMode
}
func CryptoPayUrl() string {
	return conf.cryptoPayURL
}
func CryptoPayToken() string {
	return conf.cryptoPayToken
}
func BotURL() string {
	return conf.botURL
}
func SetBotURL(botURL string) {
	conf.botURL = botURL
}
func YookasaUrl() string {
	return conf.yookasaURL
}
func YookasaShopId() string {
	return conf.yookasaShopId
}
func YookasaSecretKey() string {
	return conf.yookasaSecretKey
}
func TrafficLimit() int {
	return conf.trafficLimit * bytesInGigabyte
}

func IsCryptoPayEnabled() bool {
	return conf.isCryptoEnabled
}

func IsYookasaEnabled() bool {
	return conf.isYookasaEnabled
}

func IsTelegramStarsEnabled() bool {
	return conf.isTelegramStarsEnabled
}

func RequirePaidPurchaseForStars() bool {
	return conf.requirePaidPurchaseForStars
}

func GetAdminTelegramId() int64 {
	return conf.adminTelegramId
}

// ForwardUserMessagesToAdmin — пересылать админу текст пользователей и неизвестные команды (FORWARD_USER_MESSAGES_TO_ADMIN).
func ForwardUserMessagesToAdmin() bool {
	return conf.forwardUserMessagesToAdmin
}

func GetHealthCheckPort() int {
	return conf.healthCheckPort
}

func IsWepAppLinkEnabled() bool {
	return conf.isWebAppLinkEnabled
}

func RemnawaveHeaders() map[string]string {
	return conf.remnawaveHeaders
}

func MoynalogUrl() string {
	return conf.moynalogURL
}

func MoynalogUsername() string {
	return conf.moynalogUsername
}

func MoynalogPassword() string {
	return conf.moynalogPassword
}

func MoynalogProxyURL() string {
	return conf.moynalogProxyURL
}

func TelegramProxyURL() string {
	return conf.telegramProxyURL
}

func IsMoynalogEnabled() bool {
	return conf.isMoynalogEnabled
}

// MoynalogReceiptForYookasa — отправлять доход в «Мой налог» после оплаты ЮKassa (см. MOYNALOG_RECEIPT_FOR).
func MoynalogReceiptForYookasa() bool {
	return conf.moynalogReceiptYookasa
}

// MoynalogReceiptForPlatega — отправлять доход после оплаты любым методом Platega.
func MoynalogReceiptForPlatega() bool {
	return conf.moynalogReceiptPlatega
}

// MoynalogReceiptForCrypto — отправлять доход после оплаты CryptoPay (сумма в purchase в RUB).
func MoynalogReceiptForCrypto() bool {
	return conf.moynalogReceiptCrypto
}

const bytesInGigabyte = 1073741824

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Panicf("env %q not set", key)
	}
	return v
}

func mustEnvInt(key string) int {
	v := mustEnv(key)
	i, err := strconv.Atoi(v)
	if err != nil {
		log.Panicf("invalid int in %q: %v", key, err)
	}
	return i
}

func envIntDefault(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		log.Panicf("invalid int in %q: %v", key, err)
	}
	return i
}

func envInt64Default(key string, def int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	i, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
	if err != nil {
		log.Panicf("invalid int64 in %q: %v", key, err)
	}
	return i
}

func envStringDefault(key string, def string) string {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v
}

func envBool(key string) bool {
	return os.Getenv(key) == "true"
}

func envBoolDefault(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	return v == "true"
}

// parseMoynalogReceiptFor задаёт, для каких способов оплаты вызывать API «Мой налог» после успешной оплаты.
// hasKey=false: переменная MOYNALOG_RECEIPT_FOR не задана — как раньше: ЮKassa и Platega.
// hasKey=true и пустая строка: явно отключить отправку доходов по всем методам.
// Иначе: список через запятую (регистр не важен): yookassa, platega, crypto.
func parseMoynalogReceiptFor(raw string, hasKey bool) {
	conf.moynalogReceiptYookasa = false
	conf.moynalogReceiptPlatega = false
	conf.moynalogReceiptCrypto = false
	if !hasKey {
		conf.moynalogReceiptYookasa = true
		conf.moynalogReceiptPlatega = true
		slog.Info("MOYNALOG_RECEIPT_FOR is unset — sending income to Мой налог for ЮKassa and Platega; set MOYNALOG_RECEIPT_FOR to override")
		return
	}
	s := strings.TrimSpace(raw)
	if s == "" {
		slog.Warn("MOYNALOG_RECEIPT_FOR is empty — income will not be sent to Мой налог for any payment method")
		return
	}
	for _, part := range strings.Split(s, ",") {
		tok := strings.ToLower(strings.TrimSpace(part))
		if tok == "" {
			continue
		}
		switch tok {
		case "yookassa", "yookasa", "youkassa", "юкасса":
			conf.moynalogReceiptYookasa = true
		case "platega", "plt":
			conf.moynalogReceiptPlatega = true
		case "crypto", "cryptopay", "cryptobot":
			conf.moynalogReceiptCrypto = true
		default:
			slog.Warn("MOYNALOG_RECEIPT_FOR: unknown token, ignored", "token", part)
		}
	}
}

// Lifecycle notifications
func LifecycleNotifyEnabled() bool {
	return conf.lifecycleNotifyEnabled
}

func LifecycleCron() string {
	return conf.lifecycleCron
}

func LifecycleNoConnectPaidEnabled() bool {
	return conf.lifecycleNoConnectPaidEnabled
}

func LifecycleNoConnectTrialEnabled() bool {
	return conf.lifecycleNoConnectTrialEnabled
}

func LifecycleNoConnectDelayHours() int {
	return conf.lifecycleNoConnectDelayHours
}

func LifecycleNoConnectMaxAgeHours() int {
	return conf.lifecycleNoConnectMaxAgeHours
}

func LifecycleWinbackEnabled() bool {
	return conf.lifecycleWinbackEnabled
}

func LifecycleWinbackDaysAfterExpiry() int {
	return conf.lifecycleWinbackDaysAfterExpiry
}

func LifecycleWinbackDiscountPercent() int {
	return conf.lifecycleWinbackDiscountPercent
}

func LifecycleWinbackDiscountTTLHours() int {
	return conf.lifecycleWinbackDiscountTTLHours
}

func LifecycleVideoGuideURL() string {
	return conf.lifecycleVideoGuideURL
}

func LifecycleSupportContact() string {
	return conf.lifecycleSupportContact
}

func InitConfig() {
	if os.Getenv("DISABLE_ENV_FILE") != "true" {
		if err := godotenv.Load(".env"); err != nil {
			log.Println("No .env loaded:", err)
		}
	}
	var err error
	conf.adminTelegramId, err = strconv.ParseInt(os.Getenv("ADMIN_TELEGRAM_ID"), 10, 64)
	if err != nil {
		panic("ADMIN_TELEGRAM_ID .env variable not set")
	}

	conf.forwardUserMessagesToAdmin = envBoolDefault("FORWARD_USER_MESSAGES_TO_ADMIN", true)

	conf.telegramToken = mustEnv("TELEGRAM_TOKEN")

	conf.isWebAppLinkEnabled = func() bool {
		isWebAppLinkEnabled := os.Getenv("IS_WEB_APP_LINK") == "true"
		return isWebAppLinkEnabled
	}()

	conf.miniApp = envStringDefault("MINI_APP_URL", "")

	conf.remnawaveTag = envStringDefault("REMNAWAVE_TAG", "")

	conf.trialRemnawaveTag = envStringDefault("TRIAL_REMNAWAVE_TAG", "")

	conf.defaultLanguage = envStringDefault("DEFAULT_LANGUAGE", "ru")

	conf.daysInMonth = envIntDefault("DAYS_IN_MONTH", 30)

	externalSquadUUIDStr := os.Getenv("EXTERNAL_SQUAD_UUID")
	if externalSquadUUIDStr != "" {
		parsedUUID, err := uuid.Parse(externalSquadUUIDStr)
		if err != nil {
			panic(fmt.Sprintf("invalid EXTERNAL_SQUAD_UUID format: %v", err))
		}
		conf.externalSquadUUID = parsedUUID
	} else {
		conf.externalSquadUUID = uuid.Nil
	}

	conf.trialTrafficLimit = mustEnvInt("TRIAL_TRAFFIC_LIMIT")

	conf.healthCheckPort = envIntDefault("HEALTH_CHECK_PORT", 8080)

	conf.trialDays = mustEnvInt("TRIAL_DAYS")

	conf.trialTrafficLimitResetStrategy = func() string {
		v := os.Getenv("TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY")
		if v == "" {
			return "month" // По умолчанию месяц
		}
		v = strings.ToLower(v)
		if v != "day" && v != "week" && v != "month" && v != "month_rolling" && v != "never" {
			panic("TRIAL_TRAFFIC_LIMIT_RESET_STRATEGY must be one of: day, week, month, month_rolling, never")
		}
		return v
	}()

	conf.trafficLimitResetStrategy = func() string {
		v := os.Getenv("TRAFFIC_LIMIT_RESET_STRATEGY")
		if v == "" {
			return "month" // По умолчанию месяц
		}
		v = strings.ToLower(v)
		if v != "day" && v != "week" && v != "month" && v != "month_rolling" && v != "never" {
			panic("TRAFFIC_LIMIT_RESET_STRATEGY must be one of: day, week, month, month_rolling, never")
		}
		return v
	}()

	conf.enableAutoPayment = envBool("ENABLE_AUTO_PAYMENT")

	conf.price1 = mustEnvInt("PRICE_1")
	conf.price3 = mustEnvInt("PRICE_3")
	conf.price6 = mustEnvInt("PRICE_6")
	conf.price12 = mustEnvInt("PRICE_12")

	conf.isTelegramStarsEnabled = envBool("TELEGRAM_STARS_ENABLED")
	if conf.isTelegramStarsEnabled {
		conf.starsPrice1 = envIntDefault("STARS_PRICE_1", conf.price1)
		conf.starsPrice3 = envIntDefault("STARS_PRICE_3", conf.price3)
		conf.starsPrice6 = envIntDefault("STARS_PRICE_6", conf.price6)
		conf.starsPrice12 = envIntDefault("STARS_PRICE_12", conf.price12)

	}
	conf.requirePaidPurchaseForStars = envBool("REQUIRE_PAID_PURCHASE_FOR_STARS")

	conf.remnawaveUrl = mustEnv("REMNAWAVE_URL")

	conf.remnawaveMode = func() string {
		v := os.Getenv("REMNAWAVE_MODE")
		if v != "" {
			if v != "remote" && v != "local" {
				panic("REMNAWAVE_MODE .env variable must be either 'remote' or 'local'")
			} else {
				return v
			}
		} else {
			return "remote"
		}
	}()

	conf.remnawaveToken = mustEnv("REMNAWAVE_TOKEN")

	conf.databaseURL = mustEnv("DATABASE_URL")

	conf.isCryptoEnabled = envBool("CRYPTO_PAY_ENABLED")
	if conf.isCryptoEnabled {
		conf.cryptoPayURL = mustEnv("CRYPTO_PAY_URL")
		conf.cryptoPayToken = mustEnv("CRYPTO_PAY_TOKEN")
	}

	conf.isYookasaEnabled = envBool("YOOKASA_ENABLED")
	if conf.isYookasaEnabled {
		conf.yookasaURL = mustEnv("YOOKASA_URL")
		conf.yookasaShopId = mustEnv("YOOKASA_SHOP_ID")
		conf.yookasaSecretKey = mustEnv("YOOKASA_SECRET_KEY")
		conf.yookasaEmail = mustEnv("YOOKASA_EMAIL")
		conf.yookasaWebhookURL = strings.TrimSpace(os.Getenv("YOOKASA_WEBHOOK_URL"))
	}

	if envBool("PLATEGA_ENABLED") {
		conf.plategaMerchantID = mustEnv("PLATEGA_MERCHANT_ID")
		conf.plategaSecret = mustEnv("PLATEGA_SECRET")
		conf.plategaWebhookURL = strings.TrimSpace(os.Getenv("PLATEGA_WEBHOOK_URL"))
		conf.isPlategaSBPEnabled = envBool("PLATEGA_SBP_ENABLED")
		conf.isPlategaCardsEnabled = envBool("PLATEGA_CARDS_ENABLED")
		conf.isPlategaAcquiringEnabled = envBool("PLATEGA_ACQUIRING_ENABLED")
		conf.isPlategaWorldwideEnabled = envBool("PLATEGA_WORLDWIDE_ENABLED")
		conf.isPlategaCryptoEnabled = envBool("PLATEGA_CRYPTO_ENABLED")
	}

	conf.trafficLimit = mustEnvInt("TRAFFIC_LIMIT")
	conf.referralDays = mustEnvInt("REFERRAL_DAYS")
	conf.referralMode = func() string {
		v := strings.ToLower(envStringDefault("REFERRAL_MODE", "default"))
		if v != "default" && v != "progressive" {
			panic("REFERRAL_MODE must be 'default' or 'progressive'")
		}
		return v
	}()
	conf.referralFirstReferrerDays = envIntDefault("REFERRAL_FIRST_REFERRER_DAYS", 7)
	conf.referralFirstRefereeDays = envIntDefault("REFERRAL_FIRST_REFEREE_DAYS", 7)
	conf.referralRepeatReferrerDays = envIntDefault("REFERRAL_REPEAT_REFERRER_DAYS", 3)
	conf.trialAddsToPaid = envBoolDefault("TRIAL_ADD_TO_PAID", true)
	conf.hwidAddPrice = mustEnvInt("HWID_ADD_PRICE")
	conf.hwidAddStarsPrice = envIntDefault("HWID_ADD_STARS_PRICE", conf.hwidAddPrice)
	conf.hwidMaxDevices = envIntDefault("HWID_MAX_DEVICE", 10)
	conf.trialHwidLimit = envIntDefault("TRIAL_HWID_LIMIT", 1)
	conf.paidHwidLimit = envIntDefault("PAID_HWID_LIMIT", 0)
	conf.hwidExtraDevicesEnabled = envBoolDefault("HWID_EXTRA_DEVICES_ENABLED", true)

	conf.serverStatusURL = os.Getenv("SERVER_STATUS_URL")
	conf.supportURL = os.Getenv("SUPPORT_URL")
	conf.feedbackURL = os.Getenv("FEEDBACK_URL")
	conf.channelURL = os.Getenv("CHANNEL_URL")
	conf.tosURL = os.Getenv("TOS_URL")
	conf.videoGuideURL = os.Getenv("VIDEO_GUIDE_URL")
	conf.serverSelectionURL = os.Getenv("SERVER_SELECTION_URL")
	conf.publicOfferURL = os.Getenv("PUBLIC_OFFER_URL")
	conf.privacyPolicyURL = os.Getenv("PRIVACY_POLICY_URL")
	conf.termsOfServiceURL = os.Getenv("TERMS_OF_SERVICE_URL")
	conf.greetingImage = strings.TrimSpace(envStringDefault("GREETING_IMAGE", ""))
	if conf.greetingImage != "" {
		gl := strings.ToLower(conf.greetingImage)
		if strings.HasPrefix(gl, "http://") || strings.HasPrefix(gl, "https://") {
			// URL — проверку на диске не делаем
		} else {
			p := conf.greetingImage
			if !filepath.IsAbs(p) {
				p = filepath.Clean(filepath.Join(".", p))
			} else {
				p = filepath.Clean(p)
			}
			if _, err := os.Stat(p); err != nil {
				slog.Warn("GREETING_IMAGE: локальный файл не найден или недоступен", "path", p, "error", err)
			}
		}
	}

	conf.squadUUIDs = func() map[uuid.UUID]uuid.UUID {
		v := os.Getenv("SQUAD_UUIDS")
		if v != "" {
			uuids := strings.Split(v, ",")
			var inboundsMap = make(map[uuid.UUID]uuid.UUID)
			for _, value := range uuids {
				uuid, err := uuid.Parse(value)
				if err != nil {
					panic(err)
				}
				inboundsMap[uuid] = uuid
			}
			slog.Info("Loaded squad UUIDs", "uuids", uuids)
			return inboundsMap
		} else {
			slog.Info("No squad UUIDs specified, all will be used")
			return map[uuid.UUID]uuid.UUID{}
		}
	}()

	// Trial Internal Squads
	conf.trialInternalSquads = func() map[uuid.UUID]uuid.UUID {
		v := os.Getenv("TRIAL_INTERNAL_SQUADS")
		if v != "" {
			uuids := strings.Split(v, ",")
			var trialSquadsMap = make(map[uuid.UUID]uuid.UUID)
			for _, value := range uuids {
				uuid, err := uuid.Parse(strings.TrimSpace(value))
				if err != nil {
					panic(fmt.Sprintf("invalid UUID in TRIAL_INTERNAL_SQUADS: %v", err))
				}
				trialSquadsMap[uuid] = uuid
			}
			slog.Info("Loaded trial internal squad UUIDs", "uuids", uuids)
			return trialSquadsMap
		} else {
			slog.Info("No trial internal squad UUIDs specified, will use regular SQUAD_UUIDS")
			return map[uuid.UUID]uuid.UUID{}
		}
	}()

	// Trial External Squad UUID
	trialExternalSquadUUIDStr := os.Getenv("TRIAL_EXTERNAL_SQUAD_UUID")
	if trialExternalSquadUUIDStr != "" {
		parsedUUID, err := uuid.Parse(trialExternalSquadUUIDStr)
		if err != nil {
			panic(fmt.Sprintf("invalid TRIAL_EXTERNAL_SQUAD_UUID format: %v", err))
		}
		conf.trialExternalSquadUUID = parsedUUID
		slog.Info("Loaded trial external squad UUID", "uuid", parsedUUID)
	} else {
		conf.trialExternalSquadUUID = uuid.Nil
		slog.Info("No trial external squad UUID specified, will use regular EXTERNAL_SQUAD_UUID")
	}

	conf.tributeWebhookUrl = os.Getenv("TRIBUTE_WEBHOOK_URL")
	if conf.tributeWebhookUrl != "" {
		conf.tributeAPIKey = mustEnv("TRIBUTE_API_KEY")
		conf.tributePaymentUrl = mustEnv("TRIBUTE_PAYMENT_URL")
	}

	// HWID Fallback Device Limit
	conf.hwidFallbackDeviceLimit = envIntDefault("HWID_FALLBACK_DEVICE_LIMIT", 2)

	// Blocked Telegram IDs
	conf.blockedTelegramIds = func() map[int64]bool {
		v := os.Getenv("BLOCKED_TELEGRAM_IDS")
		if v != "" {
			ids := strings.Split(v, ",")
			var blockedMap = make(map[int64]bool)
			for _, idStr := range ids {
				id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 64)
				if err != nil {
					panic(fmt.Sprintf("invalid telegram ID in BLOCKED_TELEGRAM_IDS: %v", err))
				}
				blockedMap[id] = true
			}
			slog.Info("Loaded blocked telegram IDs", "count", len(blockedMap))
			return blockedMap
		} else {
			slog.Info("No blocked telegram IDs specified")
			return map[int64]bool{}
		}
	}()

	// Whitelisted Telegram IDs
	conf.whitelistedTelegramIds = func() map[int64]bool {
		v := os.Getenv("WHITELISTED_TELEGRAM_IDS")
		if v != "" {
			ids := strings.Split(v, ",")
			var whitelistedMap = make(map[int64]bool)
			for _, idStr := range ids {
				id, err := strconv.ParseInt(strings.TrimSpace(idStr), 10, 64)
				if err != nil {
					panic(fmt.Sprintf("invalid telegram ID in WHITELISTED_TELEGRAM_IDS: %v", err))
				}
				whitelistedMap[id] = true
			}
			slog.Info("Loaded whitelisted telegram IDs", "count", len(whitelistedMap))
			return whitelistedMap
		} else {
			slog.Info("No whitelisted telegram IDs specified")
			return map[int64]bool{}
		}
	}()

	conf.remnawaveHeaders = func() map[string]string {
		v := os.Getenv("REMNAWAVE_HEADERS")
		if v != "" {
			headers := make(map[string]string)
			pairs := strings.Split(v, ";")
			for _, pair := range pairs {
				parts := strings.SplitN(strings.TrimSpace(pair), ":", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					value := strings.TrimSpace(parts[1])
					if key != "" && value != "" {
						headers[key] = value
					}
				}
			}
			if len(headers) > 0 {
				slog.Info("Loaded remnawave headers", "count", len(headers))
				return headers
			}
		}
		return map[string]string{}
	}()

	conf.isMoynalogEnabled = envBool("MOYNALOG_ENABLED")
	if conf.isMoynalogEnabled {
		conf.moynalogURL = envStringDefault("MOYNALOG_URL", "https://moynalog.ru/api/v1")
		conf.moynalogProxyURL = envStringDefault("MOYNALOG_PROXY_URL", "")
		conf.moynalogUsername = mustEnv("MOYNALOG_USERNAME")
		conf.moynalogPassword = mustEnv("MOYNALOG_PASSWORD")
		rawReceiptFor, hasReceiptFor := os.LookupEnv("MOYNALOG_RECEIPT_FOR")
		parseMoynalogReceiptFor(rawReceiptFor, hasReceiptFor)
	}

	conf.telegramProxyURL = envStringDefault("TELEGRAM_PROXY_URL", "")

	conf.salesMode = strings.ToLower(envStringDefault("SALES_MODE", "classic"))
	if conf.salesMode != "classic" && conf.salesMode != "tariffs" {
		panic("SALES_MODE must be 'classic' or 'tariffs'")
	}

	conf.showLongTermSavingsPercent = envBoolDefault("SHOW_LONG_TERM_SAVINGS_PERCENT", false)

	conf.rubPerStar = func() float64 {
		v := strings.TrimSpace(os.Getenv("RUB_PER_STAR"))
		if v == "" {
			return 0
		}
		f, err := strconv.ParseFloat(v, 64)
		if err != nil || f < 0 {
			return 0
		}
		return f
	}()

	conf.loyaltyEnabled = envBoolDefault("LOYALTY_ENABLED", false)
	conf.loyaltyMaxTotalDiscountPercent = envIntDefault("LOYALTY_MAX_TOTAL_DISCOUNT_PERCENT", 100)
	if conf.loyaltyMaxTotalDiscountPercent < 1 {
		conf.loyaltyMaxTotalDiscountPercent = 1
	}
	if conf.loyaltyMaxTotalDiscountPercent > 100 {
		conf.loyaltyMaxTotalDiscountPercent = 100
	}
	conf.loyaltyXPMinPerPurchase = envInt64Default("LOYALTY_XP_MIN_PER_PURCHASE", 0)
	if conf.loyaltyXPMinPerPurchase < 0 {
		conf.loyaltyXPMinPerPurchase = 0
	}
	if conf.loyaltyEnabled {
		slog.Info("Loyalty program enabled", "max_total_discount_percent", conf.loyaltyMaxTotalDiscountPercent)
		if conf.loyaltyXPMinPerPurchase > 0 {
			slog.Info("Loyalty XP min per purchase active", "min_per_purchase", conf.loyaltyXPMinPerPurchase)
		}
	}

	conf.paymentsNotifyEnabled = envBoolDefault("PAYMENTS_NOTIFY_ENABLED", false)
	chatRaw := strings.TrimSpace(os.Getenv("PAYMENTS_NOTIFY_CHAT_ID"))
	if chatRaw != "" {
		cid, err := strconv.ParseInt(chatRaw, 10, 64)
		if err != nil {
			panic(fmt.Sprintf("invalid PAYMENTS_NOTIFY_CHAT_ID: %v", err))
		}
		conf.paymentsNotifyChatID = cid
	}
	conf.paymentsNotifyMessageThreadID = envIntDefault("PAYMENTS_NOTIFY_MESSAGE_THREAD_ID", 0)
	conf.paymentsNotifySendPaid = false
	conf.paymentsNotifySendCancel = false
	if conf.paymentsNotifyEnabled {
		if conf.paymentsNotifyChatID == 0 {
			slog.Warn("PAYMENTS_NOTIFY_ENABLED=true but PAYMENTS_NOTIFY_CHAT_ID is empty — уведомления о платежах отправляться не будут")
		}
		eventsRaw := strings.TrimSpace(os.Getenv("PAYMENTS_NOTIFY_EVENTS"))
		if eventsRaw == "" {
			conf.paymentsNotifySendPaid = true
			conf.paymentsNotifySendCancel = true
		} else {
			for _, p := range strings.Split(eventsRaw, ",") {
				switch strings.ToLower(strings.TrimSpace(p)) {
				case "paid":
					conf.paymentsNotifySendPaid = true
				case "cancel":
					conf.paymentsNotifySendCancel = true
				case "":
				default:
					slog.Warn("PAYMENTS_NOTIFY_EVENTS: неизвестное значение, пропуск", "token", p)
				}
			}
		}
	}

	// Lifecycle notifications
	conf.lifecycleNotifyEnabled = envBoolDefault("LIFECYCLE_NOTIFY_ENABLED", false)
	conf.lifecycleCron = envStringDefault("LIFECYCLE_CRON", "*/30 * * * *")
	conf.lifecycleNoConnectPaidEnabled = envBoolDefault("LIFECYCLE_NO_CONNECT_PAID_ENABLED", true)
	conf.lifecycleNoConnectTrialEnabled = envBoolDefault("LIFECYCLE_NO_CONNECT_TRIAL_ENABLED", true)
	conf.lifecycleNoConnectDelayHours = envIntDefault("LIFECYCLE_NO_CONNECT_DELAY_HOURS", 1)
	conf.lifecycleNoConnectMaxAgeHours = envIntDefault("LIFECYCLE_NO_CONNECT_MAX_AGE_HOURS", 24)
	conf.lifecycleWinbackEnabled = envBoolDefault("LIFECYCLE_WINBACK_ENABLED", true)
	conf.lifecycleWinbackDaysAfterExpiry = envIntDefault("LIFECYCLE_WINBACK_DAYS_AFTER_EXPIRY", 5)
	conf.lifecycleWinbackDiscountPercent = envIntDefault("LIFECYCLE_WINBACK_DISCOUNT_PERCENT", 10)
	conf.lifecycleWinbackDiscountTTLHours = envIntDefault("LIFECYCLE_WINBACK_DISCOUNT_TTL_HOURS", 48)
	conf.lifecycleVideoGuideURL = envStringDefault("LIFECYCLE_VIDEO_GUIDE_URL", "")
	conf.lifecycleSupportContact = envStringDefault("LIFECYCLE_SUPPORT_CONTACT", "")
}

// PaymentsNotifyEnabled — PAYMENTS_NOTIFY_ENABLED.
func PaymentsNotifyEnabled() bool { return conf.paymentsNotifyEnabled }

// PaymentsNotifyChatID — PAYMENTS_NOTIFY_CHAT_ID (0 если не задан).
func PaymentsNotifyChatID() int64 { return conf.paymentsNotifyChatID }

// PaymentsNotifyMessageThreadID — PAYMENTS_NOTIFY_MESSAGE_THREAD_ID (тема форума; 0 — основной чат).
func PaymentsNotifyMessageThreadID() int { return conf.paymentsNotifyMessageThreadID }

// PaymentsNotifySendPaid — слать уведомления об успешной оплате (событие paid).
func PaymentsNotifySendPaid() bool { return conf.paymentsNotifySendPaid }

// PaymentsNotifySendCancel — слать уведомления об отмене счёта (событие cancel).
func PaymentsNotifySendCancel() bool { return conf.paymentsNotifySendCancel }
