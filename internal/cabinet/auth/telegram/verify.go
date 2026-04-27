// Package telegram — проверка подлинности данных Telegram Login.
//
// Поддерживаются два источника:
//
//  1. Login Widget (source=widget): браузер POSTит плоский JSON с полями
//     id, first_name, last_name, username, photo_url, auth_date, hash.
//     Алгоритм проверки — стандартный telegram.org/widgets/login.
//
//  2. Mini App / WebApp (source=miniapp): браузер POSTит строку initData
//     (URL-encoded), приходящую из window.Telegram.WebApp.initData.
//     Алгоритм — «checking initData» из документации Telegram Mini Apps.
//
// Секрет подписи — токен того бота, чей Login Widget / Mini App использует клиент.
// В процессе кабинета: CABINET_TELEGRAM_LOGIN_BOT_TOKEN, иначе TELEGRAM_TOKEN
// (см. internal/cabinet/http/router.go).
package telegram

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// maxAuthAge — максимальный допустимый возраст auth_date. RFC не регламентирует,
// но 10 минут — стандартная рекомендация Telegram.
const maxAuthAge = 10 * time.Minute

// ErrInvalidHash — HMAC не совпал (данные подменены или неверный bot token).
var ErrInvalidHash = errors.New("telegram: invalid hash")

// ErrAuthDateExpired — auth_date слишком старый (replay-защита).
var ErrAuthDateExpired = errors.New("telegram: auth_date expired")

// ErrMissingFields — обязательные поля отсутствуют.
var ErrMissingFields = errors.New("telegram: missing required fields")

// ============================================================================
// Widget
// ============================================================================

// WidgetData — поля, которые Telegram Login Widget передаёт после авторизации.
// Все строковые поля, кроме ID/AuthDate, опциональны.
type WidgetData struct {
	ID        int64 // telegram user id
	FirstName string
	LastName  string
	Username  string
	PhotoURL  string
	AuthDate  int64 // unix timestamp
	Hash      string
}

// VerifyWidget проверяет подлинность WidgetData по bot-токену.
//
// Алгоритм (telegram.org/widgets/login#checking-authorization):
//  1. Собираем data-check-string: все поля кроме hash, отсортированные по
//     имени, join "\n".
//  2. secret_key = SHA256(bot_token)
//  3. hash == HMAC-SHA256(data_check_string, secret_key) hex
func VerifyWidget(d WidgetData, botToken string) error {
	if d.ID == 0 || d.AuthDate == 0 || d.Hash == "" {
		return ErrMissingFields
	}
	if time.Since(time.Unix(d.AuthDate, 0)) > maxAuthAge {
		return ErrAuthDateExpired
	}

	dataMap := widgetDataMap(d)
	checkString := buildCheckString(dataMap)

	sk := sha256BotKey(botToken)
	mac := hmac.New(sha256.New, sk)
	mac.Write([]byte(checkString))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(d.Hash), []byte(expected)) {
		return ErrInvalidHash
	}
	return nil
}

// widgetDataMap — строковая карта значений Widget (без hash).
func widgetDataMap(d WidgetData) map[string]string {
	m := map[string]string{
		"id":        strconv.FormatInt(d.ID, 10),
		"auth_date": strconv.FormatInt(d.AuthDate, 10),
	}
	if d.FirstName != "" {
		m["first_name"] = d.FirstName
	}
	if d.LastName != "" {
		m["last_name"] = d.LastName
	}
	if d.Username != "" {
		m["username"] = d.Username
	}
	if d.PhotoURL != "" {
		m["photo_url"] = d.PhotoURL
	}
	return m
}

// ============================================================================
// Mini App / WebApp
// ============================================================================

// MiniAppData — разобранный initData из window.Telegram.WebApp.initData.
type MiniAppData struct {
	UserID   int64  // из вложенного JSON поля user.id
	Username string // из user.username (опционально)
	AuthDate int64
	Hash     string
	Raw      string // исходная URL-encoded строка (для логов)
}

// ParseAndVerifyMiniApp разбирает URL-encoded initData, проверяет HMAC
// и возвращает MiniAppData.
//
// Алгоритм (Telegram Mini Apps "Validating data received via the Mini App"):
//  1. Разбиваем initData по "&".
//  2. Убираем пару "hash=..." из списка.
//  3. Сортируем оставшиеся пары лексикографически.
//  4. Соединяем через "\n".
//  5. secret_key = HMAC-SHA256("WebAppData", bot_token)
//  6. hash == HMAC-SHA256(data_check_string, secret_key) hex
func ParseAndVerifyMiniApp(initData, botToken string) (*MiniAppData, error) {
	if initData == "" {
		return nil, ErrMissingFields
	}

	values, err := url.ParseQuery(initData)
	if err != nil {
		return nil, fmt.Errorf("telegram miniapp: parse initData: %w", err)
	}

	hash := values.Get("hash")
	if hash == "" {
		return nil, ErrMissingFields
	}
	authDateStr := values.Get("auth_date")
	if authDateStr == "" {
		return nil, ErrMissingFields
	}
	authDate, err := strconv.ParseInt(authDateStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("telegram miniapp: parse auth_date: %w", err)
	}
	if time.Since(time.Unix(authDate, 0)) > maxAuthAge {
		return ErrAuthDateExpiredMini, ErrAuthDateExpired
	}

	// Строим data_check_string: все пары кроме hash, sorted, join \n.
	var parts []string
	for k, vs := range values {
		if k == "hash" {
			continue
		}
		parts = append(parts, k+"="+vs[0])
	}
	sort.Strings(parts)
	checkString := strings.Join(parts, "\n")

	// secret = HMAC-SHA256(bot_token, "WebAppData")
	// В Go это: key="WebAppData", message=bot_token.
	h1 := hmac.New(sha256.New, []byte("WebAppData"))
	h1.Write([]byte(botToken))
	secret := h1.Sum(nil)

	h2 := hmac.New(sha256.New, secret)
	h2.Write([]byte(checkString))
	expected := hex.EncodeToString(h2.Sum(nil))

	if !hmac.Equal([]byte(hash), []byte(expected)) {
		return nil, ErrInvalidHash
	}

	// Извлекаем user.id и user.username из поля "user" (JSON).
	data := &MiniAppData{AuthDate: authDate, Hash: hash, Raw: initData}
	userRaw := values.Get("user")
	if userRaw != "" {
		// Простой парсинг без json.Unmarshal, чтобы не тянуть лишний импорт
		// (поля фиксированные, нам нужны только id и username).
		data.UserID = extractInt64Field(userRaw, "id")
		data.Username = extractStringField(userRaw, "username")
	}
	if data.UserID == 0 {
		return nil, fmt.Errorf("telegram miniapp: user.id missing or zero")
	}

	return data, nil
}

// ErrAuthDateExpiredMini — вспомогательный nil-тип для двойного возврата выше.
// Реальная ошибка всегда — ErrAuthDateExpired.
var ErrAuthDateExpiredMini *MiniAppData = nil

// ============================================================================
// Helpers
// ============================================================================

// buildCheckString собирает отсортированный "key=value\nkey=value..." из карты.
func buildCheckString(m map[string]string) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+m[k])
	}
	return strings.Join(parts, "\n")
}

// sha256BotKey вычисляет SHA256(bot_token) для проверки Widget.
func sha256BotKey(botToken string) []byte {
	h := sha256.Sum256([]byte(botToken))
	return h[:]
}

// extractInt64Field извлекает числовое поле из JSON-строки вида {...,"id":12345,...}
// без полноценного decode. Используется только для поля "id" в user.
func extractInt64Field(jsonStr, field string) int64 {
	needle := `"` + field + `":`
	idx := strings.Index(jsonStr, needle)
	if idx < 0 {
		return 0
	}
	rest := strings.TrimSpace(jsonStr[idx+len(needle):])
	// Читаем цифры до нецифрового символа.
	end := 0
	for end < len(rest) && rest[end] >= '0' && rest[end] <= '9' {
		end++
	}
	if end == 0 {
		return 0
	}
	n, _ := strconv.ParseInt(rest[:end], 10, 64)
	return n
}

// extractStringField извлекает строковое поле из JSON вида {...,"field":"value",...}.
func extractStringField(jsonStr, field string) string {
	needle := `"` + field + `":"`
	idx := strings.Index(jsonStr, needle)
	if idx < 0 {
		return ""
	}
	rest := jsonStr[idx+len(needle):]
	end := strings.IndexByte(rest, '"')
	if end < 0 {
		return ""
	}
	return rest[:end]
}
