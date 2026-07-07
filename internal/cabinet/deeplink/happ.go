package deeplink

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// happCryptoAPIURL — официальный сервис Happ, шифрующий ссылку подписки
// (RSA-4096) и возвращающий deep link happ://crypt5/. См.
// https://www.happ.su/main/ru/dev-docs/crypto-link.
//
// ВНИМАНИЕ: сюда уходит ссылка подписки пользователя (по сути секрет) на
// сторонний сервис happ.su. Это неизбежно при использовании официального API
// Happ и включается администратором осознанно (CABINET_DEEPLINK_HAPP_ENCRYPT).
const happCryptoAPIURL = "https://crypto.happ.su/api-v2.php"

const happRequestTimeout = 10 * time.Second

// happClient переиспользуется между вызовами (пул соединений, keep-alive).
var happClient = &http.Client{Timeout: happRequestTimeout}

// happResponse — тело ответа crypto.happ.su/api-v2.php.
type happResponse struct {
	EncryptedLink string `json:"encrypted_link"`
	Error         string `json:"error"`
}

// EncryptHapp обращается к API Happ и возвращает готовый deep link
// (happ://crypt5/...). Ссылку не логируем — это секрет.
func EncryptHapp(ctx context.Context, subscriptionURL string) (string, error) {
	subscriptionURL = strings.TrimSpace(subscriptionURL)
	if subscriptionURL == "" {
		return "", errors.New("happ: empty subscription url")
	}

	reqBody, err := json.Marshal(map[string]string{"url": subscriptionURL})
	if err != nil {
		return "", fmt.Errorf("happ: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, happCryptoAPIURL, bytes.NewReader(reqBody))
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
	return link, nil
}
