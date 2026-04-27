// Package config — чтение и валидация env-переменных web-кабинета.
//
// Пакет намеренно отделён от internal/config (который используется ботом), чтобы:
//   - избежать разрастания единого файла конфига;
//   - иметь возможность полностью пропустить инициализацию кабинета, если CABINET_ENABLED=false.
//
// Все функции-геттеры безопасны к вызову до InitConfig() — они возвращают zero-value.
// Это удобно для тестов и для кода, который не хочет проверять флаг включения.
package config

import (
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"remnawave-tg-shop-bot/utils"
)

// cabinet — набор всех параметров кабинета, заполняется в InitConfig().
type cabinet struct {
	enabled bool

	publicURL      *url.URL
	publicURLRaw   string
	allowedOrigins []string
	cookieDomain   string

	jwtSecret         []byte
	accessTTLMinutes  int
	refreshTTLDays    int
	webTelegramIDBase int64

	smtpHost     string
	smtpPort     int
	smtpUser     string
	smtpPassword string
	smtpTLS      bool
	mailFrom     string

	googleClientID     string
	googleClientSecret string
	googleRedirectURL  string

	telegramLoginBotUsername string
	telegramLoginBotToken  string // опционально: HMAC Login Widget / Mini App, если отличается от TELEGRAM_TOKEN
	telegramOIDCClientID    string
	telegramOIDCClientSecret string
	telegramOIDCRedirectURL string
	telegramWebAuthMode     string

	turnstileEnabled    bool
	turnstileSiteKey    string
	turnstileSecretKey  string

	metricsUser     string
	metricsPassword string

	// devTelegramUnlink — CABINET_DEV_TELEGRAM_UNLINK: POST /me/telegram/unlink-dev (только для стендов).
	devTelegramUnlink bool

	// miniAppEntryURL — абсолютный URL для Telegram WebApp (кнопки «Мой VPN», «Подключить VPN»).
	miniAppEntryURL string

	// brandName — подпись в шапке/футере SPA (CABINET_BRAND_NAME).
	brandName string
	// brandLogoURLRaw — URL или относительный путь картинки (CABINET_BRAND_LOGO_URL).
	brandLogoURLRaw string
	// brandLogoFile — абсолютный путь к файлу на диске (CABINET_BRAND_LOGO_FILE), если валиден.
	brandLogoFile string
}

var conf cabinet

// IsEnabled возвращает значение CABINET_ENABLED. До InitConfig() — false.
func IsEnabled() bool { return conf.enabled }

// PublicURL возвращает публичный URL кабинета (например https://cabinet.example.com).
func PublicURL() string { return conf.publicURLRaw }

// AllowedOrigins — whitelist для CORS.
func AllowedOrigins() []string { return conf.allowedOrigins }

// CookieDomain — домен refresh-cookie. Если был пуст в env, подставляется host из CABINET_PUBLIC_URL.
func CookieDomain() string { return conf.cookieDomain }

// JWTSecret — секрет подписи access-токенов. Байты, а не строка (чтобы не ловить случайных trim).
func JWTSecret() []byte { return conf.jwtSecret }

// AccessTTLMinutes — TTL access-токена, минуты.
func AccessTTLMinutes() int { return conf.accessTTLMinutes }

// RefreshTTLDays — TTL refresh-токена, дни.
func RefreshTTLDays() int { return conf.refreshTTLDays }

// WebTelegramIDBase — база synthetic telegram_id для web-only клиентов.
func WebTelegramIDBase() int64 { return conf.webTelegramIDBase }

// SMTP-параметры.
func SMTPHost() string     { return conf.smtpHost }
func SMTPPort() int        { return conf.smtpPort }
func SMTPUser() string     { return conf.smtpUser }
func SMTPPassword() string { return conf.smtpPassword }
func SMTPTLS() bool        { return conf.smtpTLS }
func MailFrom() string     { return conf.mailFrom }

// SMTPEnabled — true, если заполнены host и from (минимум для отправки писем).
func SMTPEnabled() bool {
	return conf.smtpHost != "" && conf.mailFrom != ""
}

// Google OAuth.
func GoogleClientID() string     { return conf.googleClientID }
func GoogleClientSecret() string { return conf.googleClientSecret }
func GoogleRedirectURL() string  { return conf.googleRedirectURL }

// GoogleEnabled — все три параметра должны быть заданы.
func GoogleEnabled() bool {
	return conf.googleClientID != "" && conf.googleClientSecret != "" && conf.googleRedirectURL != ""
}

// TelegramLoginBotUsername — username бота (без @) для Telegram Login Widget.
func TelegramLoginBotUsername() string { return conf.telegramLoginBotUsername }

// TelegramLoginBotToken — токен того же бота, что и CABINET_TELEGRAM_LOGIN_BOT_USERNAME,
// для проверки HMAC виджета и initData. Если пусто — используется TELEGRAM_TOKEN процесса.
func TelegramLoginBotToken() string { return conf.telegramLoginBotToken }
func TelegramOIDCClientID() string { return conf.telegramOIDCClientID }
func TelegramOIDCClientSecret() string { return conf.telegramOIDCClientSecret }
func TelegramOIDCRedirectURL() string { return conf.telegramOIDCRedirectURL }
func TelegramWebAuthMode() string { return conf.telegramWebAuthMode }
func TelegramWidgetEnabled() bool {
	return conf.telegramWebAuthMode == "widget"
}
func TelegramOIDCEnabled() bool {
	if conf.telegramWebAuthMode != "oidc" {
		return false
	}
	return conf.telegramOIDCClientID != "" && conf.telegramOIDCClientSecret != "" && conf.telegramOIDCRedirectURL != ""
}

// Turnstile.
func TurnstileEnabled() bool   { return conf.turnstileEnabled }
func TurnstileSiteKey() string { return conf.turnstileSiteKey }
func TurnstileSecretKey() string {
	return conf.turnstileSecretKey
}

// MetricsUser / MetricsPassword — опциональная Basic-auth защита GET /cabinet/api/metrics.
// Если оба пусты — эндпоинт открыт (допустимо только за reverse-proxy с ACL).
func MetricsUser() string     { return conf.metricsUser }
func MetricsPassword() string { return conf.metricsPassword }

// DevTelegramUnlinkEnabled — если true, доступен POST /cabinet/api/me/telegram/unlink-dev
// (удаляет cabinet_identity telegram у текущего аккаунта). На проде держите false.
func DevTelegramUnlinkEnabled() bool { return conf.devTelegramUnlink }

// MiniAppEntryURL — полный URL веб-приложения кабинета для кнопок WebApp в Telegram-боте.
// Пусто, если кабинет выключен или InitConfig ещё не вызывался.
// Источник: CABINET_MINI_APP_URL или CABINET_PUBLIC_URL + CABINET_MINI_APP_PATH (по умолчанию /cabinet/).
func MiniAppEntryURL() string { return conf.miniAppEntryURL }

// BrandName — отображаемое имя кабинета в UI. Пустой env → "Cabinet".
func BrandName() string {
	if strings.TrimSpace(conf.brandName) == "" {
		return "Cabinet"
	}
	return strings.TrimSpace(conf.brandName)
}

// BrandLogoFile — абсолютный путь к файлу логотипа на диске (CABINET_BRAND_LOGO_FILE), или "".
func BrandLogoFile() string { return conf.brandLogoFile }

// BrandLogoURLForClient — URL для атрибута src у <img>: http(s), путь с /, относительный к публичному URL,
// либо /cabinet/api/public/brand-logo при настроенном CABINET_BRAND_LOGO_FILE.
// Приоритет: CABINET_BRAND_LOGO_URL над CABINET_BRAND_LOGO_FILE.
func BrandLogoURLForClient() string {
	s := strings.TrimSpace(conf.brandLogoURLRaw)
	if s != "" {
		if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
			return s
		}
		if strings.HasPrefix(s, "/") {
			return s
		}
		return strings.TrimRight(conf.publicURLRaw, "/") + "/" + strings.TrimLeft(s, "/")
	}
	if conf.brandLogoFile != "" {
		return strings.TrimRight(conf.publicURLRaw, "/") + "/cabinet/api/public/brand-logo"
	}
	return ""
}

// InitConfig читает все CABINET_* переменные и выполняет строгие проверки.
// Должен вызываться после config.InitConfig() бота и только если CABINET_ENABLED=true.
// При ошибках конфигурации — panic с понятным сообщением.
func InitConfig() {
	conf.enabled = envBool("CABINET_ENABLED", false)
	if !conf.enabled {
		slog.Info("cabinet disabled (CABINET_ENABLED=false)")
		return
	}

	// Public URL обязателен, если кабинет включён.
	publicRaw := strings.TrimSpace(os.Getenv("CABINET_PUBLIC_URL"))
	if publicRaw == "" {
		panic("CABINET_PUBLIC_URL is required when CABINET_ENABLED=true")
	}
	parsed, err := url.Parse(publicRaw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		panic(fmt.Sprintf("CABINET_PUBLIC_URL must be a full URL (got %q)", publicRaw))
	}
	if parsed.Scheme != "https" {
		slog.Warn("CABINET_PUBLIC_URL is not https; acceptable only for local dev", "url", publicRaw)
	}
	conf.publicURL = parsed
	conf.publicURLRaw = strings.TrimRight(publicRaw, "/")

	miniOverride := strings.TrimSpace(os.Getenv("CABINET_MINI_APP_URL"))
	if miniOverride != "" {
		parsedMini, err := url.Parse(miniOverride)
		if err != nil || parsedMini.Scheme == "" || parsedMini.Host == "" {
			panic(fmt.Sprintf("CABINET_MINI_APP_URL must be a full URL (got %q)", miniOverride))
		}
		conf.miniAppEntryURL = strings.TrimRight(miniOverride, "/") + "/"
	} else {
		path := strings.TrimSpace(os.Getenv("CABINET_MINI_APP_PATH"))
		if path == "" {
			path = "/cabinet/"
		}
		if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		if !strings.HasSuffix(path, "/") {
			path += "/"
		}
		conf.miniAppEntryURL = conf.publicURLRaw + path
	}

	// CORS allowlist. Если не задан — fallback на PublicURL.
	origins := strings.TrimSpace(os.Getenv("CABINET_ALLOWED_ORIGINS"))
	if origins == "" {
		conf.allowedOrigins = []string{conf.publicURLRaw}
	} else {
		for _, o := range strings.Split(origins, ",") {
			o = strings.TrimSpace(strings.TrimRight(o, "/"))
			if o != "" {
				conf.allowedOrigins = append(conf.allowedOrigins, o)
			}
		}
	}

	// Cookie domain. Если пусто — берём host из публичного URL.
	conf.cookieDomain = strings.TrimSpace(os.Getenv("CABINET_COOKIE_DOMAIN"))
	if conf.cookieDomain == "" {
		conf.cookieDomain = parsed.Hostname()
	}

	// JWT секрет. Требуем >= 32 байта, иначе подпись слишком слабая.
	secret := os.Getenv("CABINET_JWT_SECRET")
	if len(secret) < 32 {
		panic("CABINET_JWT_SECRET is required and must be >= 32 bytes (openssl rand -hex 32)")
	}
	conf.jwtSecret = []byte(secret)

	conf.accessTTLMinutes = envIntDefault("CABINET_ACCESS_TTL_MINUTES", 15)
	if conf.accessTTLMinutes <= 0 {
		panic("CABINET_ACCESS_TTL_MINUTES must be > 0")
	}
	conf.refreshTTLDays = envIntDefault("CABINET_REFRESH_TTL_DAYS", 30)
	if conf.refreshTTLDays <= 0 {
		panic("CABINET_REFRESH_TTL_DAYS must be > 0")
	}

	conf.webTelegramIDBase = envInt64Default("CABINET_WEB_TELEGRAM_ID_BASE", utils.SyntheticTelegramIDBase)
	if conf.webTelegramIDBase <= 0 {
		panic("CABINET_WEB_TELEGRAM_ID_BASE must be > 0")
	}
	utils.SetSyntheticTelegramIDBase(conf.webTelegramIDBase)

	// SMTP.
	conf.smtpHost = strings.TrimSpace(os.Getenv("CABINET_SMTP_HOST"))
	conf.smtpPort = envIntDefault("CABINET_SMTP_PORT", 465)
	conf.smtpUser = strings.TrimSpace(os.Getenv("CABINET_SMTP_USER"))
	conf.smtpPassword = os.Getenv("CABINET_SMTP_PASSWORD")
	conf.smtpTLS = envBool("CABINET_SMTP_TLS", true)
	conf.mailFrom = strings.TrimSpace(os.Getenv("CABINET_MAIL_FROM"))

	// Google OAuth (опционально).
	conf.googleClientID = strings.TrimSpace(os.Getenv("CABINET_GOOGLE_CLIENT_ID"))
	conf.googleClientSecret = os.Getenv("CABINET_GOOGLE_CLIENT_SECRET")
	conf.googleRedirectURL = strings.TrimSpace(os.Getenv("CABINET_GOOGLE_REDIRECT_URL"))
	if conf.googleClientID != "" && conf.googleRedirectURL != "" {
		if !strings.HasPrefix(conf.googleRedirectURL, conf.publicURLRaw) {
			slog.Warn("CABINET_GOOGLE_REDIRECT_URL does not start with CABINET_PUBLIC_URL",
				"redirect_url", conf.googleRedirectURL,
				"public_url", conf.publicURLRaw,
			)
		}
	}

	conf.telegramLoginBotUsername = strings.TrimSpace(os.Getenv("CABINET_TELEGRAM_LOGIN_BOT_USERNAME"))
	conf.telegramLoginBotUsername = strings.TrimPrefix(conf.telegramLoginBotUsername, "@")
	conf.telegramLoginBotToken = strings.TrimSpace(os.Getenv("CABINET_TELEGRAM_LOGIN_BOT_TOKEN"))
	conf.telegramOIDCClientID = strings.TrimSpace(os.Getenv("CABINET_TELEGRAM_OIDC_CLIENT_ID"))
	conf.telegramOIDCClientSecret = strings.TrimSpace(os.Getenv("CABINET_TELEGRAM_OIDC_CLIENT_SECRET"))
	conf.telegramOIDCRedirectURL = strings.TrimSpace(os.Getenv("CABINET_TELEGRAM_OIDC_REDIRECT_URL"))
	conf.telegramWebAuthMode = strings.ToLower(strings.TrimSpace(os.Getenv("CABINET_TELEGRAM_WEB_AUTH_MODE")))
	if conf.telegramWebAuthMode == "" {
		conf.telegramWebAuthMode = "oidc"
	}
	switch conf.telegramWebAuthMode {
	case "widget", "oidc":
	default:
		panic("CABINET_TELEGRAM_WEB_AUTH_MODE must be one of: widget, oidc")
	}
	if conf.telegramOIDCClientID != "" && conf.telegramOIDCRedirectURL == "" {
		conf.telegramOIDCRedirectURL = strings.TrimRight(conf.publicURLRaw, "/") + "/cabinet/api/auth/telegram/callback"
	}
	if TelegramWidgetEnabled() && conf.telegramLoginBotUsername == "" {
		panic("CABINET_TELEGRAM_LOGIN_BOT_USERNAME is required when CABINET_TELEGRAM_WEB_AUTH_MODE=widget")
	}
	if conf.telegramWebAuthMode == "oidc" &&
		(conf.telegramOIDCClientID == "" || conf.telegramOIDCClientSecret == "") {
		panic("CABINET_TELEGRAM_OIDC_CLIENT_ID and CABINET_TELEGRAM_OIDC_CLIENT_SECRET are required when CABINET_TELEGRAM_WEB_AUTH_MODE=oidc")
	}

	conf.turnstileEnabled = envBool("CABINET_TURNSTILE_ENABLED", false)
	conf.turnstileSiteKey = strings.TrimSpace(os.Getenv("CABINET_TURNSTILE_SITE_KEY"))
	conf.turnstileSecretKey = os.Getenv("CABINET_TURNSTILE_SECRET_KEY")
	if conf.turnstileEnabled && (conf.turnstileSiteKey == "" || conf.turnstileSecretKey == "") {
		panic("CABINET_TURNSTILE_SITE_KEY and CABINET_TURNSTILE_SECRET_KEY are required when CABINET_TURNSTILE_ENABLED=true")
	}

	conf.metricsUser = strings.TrimSpace(os.Getenv("CABINET_METRICS_USER"))
	conf.metricsPassword = os.Getenv("CABINET_METRICS_PASSWORD")
	if (conf.metricsUser == "") != (conf.metricsPassword == "") {
		panic("CABINET_METRICS_USER and CABINET_METRICS_PASSWORD must be both set or both empty")
	}

	conf.devTelegramUnlink = envBool("CABINET_DEV_TELEGRAM_UNLINK", false)
	if conf.devTelegramUnlink {
		slog.Warn("CABINET_DEV_TELEGRAM_UNLINK is enabled — dev-only Telegram unlink API is exposed; disable on production")
	}

	conf.brandName = strings.TrimSpace(os.Getenv("CABINET_BRAND_NAME"))
	conf.brandLogoURLRaw = strings.TrimSpace(os.Getenv("CABINET_BRAND_LOGO_URL"))
	logoFileRaw := strings.TrimSpace(os.Getenv("CABINET_BRAND_LOGO_FILE"))
	if logoFileRaw != "" {
		if resolved := resolveBrandLogoFile(logoFileRaw); resolved != "" {
			conf.brandLogoFile = resolved
		} else {
			slog.Warn("CABINET_BRAND_LOGO_FILE: file not found (cwd, binary dir, CABINET_BRAND_LOGO_FILE_BASE)",
				"path", logoFileRaw,
			)
		}
	}

	slog.Info("cabinet config initialized",
		"public_url", conf.publicURLRaw,
		"mini_app_entry_url", conf.miniAppEntryURL,
		"cookie_domain", conf.cookieDomain,
		"allowed_origins", conf.allowedOrigins,
		"access_ttl_min", conf.accessTTLMinutes,
		"refresh_ttl_days", conf.refreshTTLDays,
		"web_tg_id_base", conf.webTelegramIDBase,
		"smtp_enabled", SMTPEnabled(),
		"google_enabled", GoogleEnabled(),
		"telegram_web_auth_mode", conf.telegramWebAuthMode,
		"telegram_login_bot", conf.telegramLoginBotUsername != "",
		"telegram_login_hmac_dedicated", conf.telegramLoginBotToken != "",
		"telegram_oidc_enabled", TelegramOIDCEnabled(),
		"turnstile_enabled", conf.turnstileEnabled,
		"metrics_basic_auth", conf.metricsUser != "",
		"brand_name", BrandName(),
		"brand_logo_configured", BrandLogoURLForClient() != "",
	)
}

// resolveBrandLogoFile ищет файл логотипа: абсолютный путь, затем относительно cwd,
// каталога исполняемого файла (удобно в Docker, когда WORKDIR=/ а бинарь в /app),
// CABINET_BRAND_LOGO_FILE_BASE, снова cwd через filepath.Abs.
func resolveBrandLogoFile(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	try := func(abs string) string {
		abs = filepath.Clean(abs)
		st, err := os.Stat(abs)
		if err != nil || st.IsDir() {
			return ""
		}
		return abs
	}

	if filepath.IsAbs(raw) {
		return try(raw)
	}

	rel := filepath.Clean(raw)
	// В Docker cwd часто «/», а бинарь лежит в /app — файл рядом с бинарником ищем в первую очередь.
	if exe, err := os.Executable(); err == nil {
		if p := try(filepath.Join(filepath.Dir(exe), rel)); p != "" {
			return p
		}
	}
	if wd, err := os.Getwd(); err == nil {
		if p := try(filepath.Join(wd, rel)); p != "" {
			return p
		}
	}
	if p, err := filepath.Abs(raw); err == nil {
		if q := try(p); q != "" {
			return q
		}
	}
	if base := strings.TrimSpace(os.Getenv("CABINET_BRAND_LOGO_FILE_BASE")); base != "" {
		if p := try(filepath.Join(base, rel)); p != "" {
			return p
		}
	}
	return ""
}

// envIntDefault — int из env с дефолтом; невалидное значение — panic.
func envIntDefault(key string, def int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		panic(fmt.Sprintf("invalid int in %q: %v", key, err))
	}
	return i
}

// envInt64Default — int64 из env с дефолтом; невалидное значение — panic.
func envInt64Default(key string, def int64) int64 {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	i, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		panic(fmt.Sprintf("invalid int64 in %q: %v", key, err))
	}
	return i
}

// envBool — bool из env с дефолтом (поддерживает "true"/"false" любой регистр).
func envBool(key string, def bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return def
	}
	return v == "true" || v == "1" || v == "yes" || v == "on"
}
