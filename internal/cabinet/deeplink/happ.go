package deeplink

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// Сервис Happ, шифрующий ссылку подписки и возвращающий готовый deep link. См.
// https://www.happ.su/main/ru/dev-docs/crypto-link.
//
// Два эндпоинта отличаются форматом ссылки:
//
//   - api-v2.php → happ://crypt5/ — актуальный формат; понимают только свежие
//     сборки приложения (Happ 5.x);
//   - api.php    → happ://crypt4/ — старый RSA-4096; понимают в том числе
//     клиенты 4.x, застрявшие без обновлений (Happ убрали из российского App
//     Store, и часть пользователей iOS обновиться не может).
//
// ВНИМАНИЕ: в обоих случаях ссылка подписки пользователя (по сути секрет)
// уходит на сторонний сервис happ.su. Это неизбежно при использовании
// официального API Happ и включается администратором осознанно
// (CABINET_DEEPLINK_HAPP_ENCRYPT).
const (
	happCryptoAPIV2URL = "https://crypto.happ.su/api-v2.php"
	happCryptoAPIV1URL = "https://crypto.happ.su/api.php"
)

// Значения CABINET_DEEPLINK_HAPP_CRYPT_VERSION.
const (
	HappCrypt5 = "crypt5"
	HappCrypt4 = "crypt4"
)

const happRequestTimeout = 10 * time.Second

// happClient переиспользуется между вызовами (пул соединений, keep-alive).
var happClient = &http.Client{Timeout: happRequestTimeout}

// happResponse — тело ответа crypto.happ.su.
type happResponse struct {
	EncryptedLink string `json:"encrypted_link"`
	Error         string `json:"error"`
}

// NormalizeHappCryptVersion приводит значение настройки к известному формату;
// пустое и незнакомое трактуются как crypt5 (поведение по умолчанию).
func NormalizeHappCryptVersion(version string) string {
	if strings.EqualFold(strings.TrimSpace(version), HappCrypt4) {
		return HappCrypt4
	}
	return HappCrypt5
}

// EncryptHapp обращается к API Happ и возвращает готовый deep link
// (happ://crypt5/… либо happ://crypt4/… — по version). Ссылку не логируем — это
// секрет.
func EncryptHapp(ctx context.Context, subscriptionURL string, version string) (string, error) {
	subscriptionURL = strings.TrimSpace(subscriptionURL)
	if subscriptionURL == "" {
		return "", errors.New("happ: empty subscription url")
	}

	version = NormalizeHappCryptVersion(version)
	apiURL := happCryptoAPIV2URL
	if version == HappCrypt4 {
		apiURL = happCryptoAPIV1URL
	}

	reqBody, err := json.Marshal(map[string]string{"url": subscriptionURL})
	if err != nil {
		return "", fmt.Errorf("happ: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("happ: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := happClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("happ: request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("happ: read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("happ: unexpected status %d", resp.StatusCode)
	}

	var out happResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return "", fmt.Errorf("happ: decode response: %w", err)
	}
	if strings.TrimSpace(out.Error) != "" {
		return "", fmt.Errorf("happ: api error: %s", out.Error)
	}
	link := strings.TrimSpace(out.EncryptedLink)
	if !strings.HasPrefix(link, "happ://") {
		return "", errors.New("happ: api returned unexpected link")
	}
	// Формат сервиса разошёлся с настройкой (например, api.php начал отдавать
	// crypt5). Ссылку всё равно возвращаем — она рабочая, — но админу нужен
	// след: выбранная совместимость молча перестала действовать.
	if !strings.HasPrefix(link, "happ://"+version+"/") {
		slog.Warn("happ: crypt version mismatch", "requested", version)
	}
	return link, nil
}
