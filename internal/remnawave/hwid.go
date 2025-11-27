package remnawave

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"remnawave-tg-shop-bot/internal/config"
	"strings"
	"time"
)

// HWIDDevice представляет устройство пользователя
type HWIDDevice struct {
	HWID        string    `json:"hwid"`
	UserUUID    string    `json:"userUuid"`
	Platform    string    `json:"platform"`
	OSVersion   string    `json:"osVersion"`
	DeviceModel string    `json:"deviceModel"`
	UserAgent   string    `json:"userAgent"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// HWIDDevicesResponse представляет ответ API для получения устройств
type HWIDDevicesResponse struct {
	Response struct {
		Total   int          `json:"total"`
		Devices []HWIDDevice `json:"devices"`
	} `json:"response"`
}

// DeleteHWIDRequest представляет запрос на удаление устройства
type DeleteHWIDRequest struct {
	UserUUID string `json:"userUuid"`
	HWID     string `json:"hwid"`
}

// DeleteHWIDResponse представляет ответ API для удаления устройства
type DeleteHWIDResponse struct {
	Response struct {
		Total   int          `json:"total"`
		Devices []HWIDDevice `json:"devices"`
	} `json:"response"`
}

// GetUserHWIDDevices получает список устройств пользователя
func (r *Client) GetUserHWIDDevices(ctx context.Context, userUUID string) (*HWIDDevicesResponse, error) {
	url := fmt.Sprintf("%s/api/hwid/devices/%s", config.RemnawaveUrl(), userUUID)
	slog.Info("Getting HWID devices", "url", url, "userUuid", userUUID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Добавляем заголовки авторизации
	req.Header.Set("X-Api-Key", config.GetXApiKey())
	if config.RemnawaveMode() == "local" {
		req.Header.Set("x-forwarded-for", "127.0.0.1")
		req.Header.Set("x-forwarded-proto", "https")
	}

	// Создаем HTTP клиент с теми же настройками
	httpClient := &http.Client{
		Transport: &headerTransport{
			base:    http.DefaultTransport,
			xApiKey: config.GetXApiKey(),
			local:   config.RemnawaveMode() == "local",
		},
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Error("API request failed", "statusCode", resp.StatusCode, "body", string(body))
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result HWIDDevicesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		slog.Error("Failed to decode response", "error", err)
		return nil, err
	}

	slog.Info("HWID devices retrieved", "total", result.Response.Total, "devicesCount", len(result.Response.Devices))
	return &result, nil
}

// DeleteUserHWIDDevice удаляет устройство пользователя
func (r *Client) DeleteUserHWIDDevice(ctx context.Context, userUUID, hwid string) (*DeleteHWIDResponse, error) {
	url := fmt.Sprintf("%s/api/hwid/devices/delete", config.RemnawaveUrl())

	requestBody := DeleteHWIDRequest{
		UserUUID: userUUID,
		HWID:     hwid,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}

	// Добавляем заголовки
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Api-Key", config.GetXApiKey())
	if config.RemnawaveMode() == "local" {
		req.Header.Set("x-forwarded-for", "127.0.0.1")
		req.Header.Set("x-forwarded-proto", "https")
	}

	// Создаем HTTP клиент с теми же настройками
	httpClient := &http.Client{
		Transport: &headerTransport{
			base:    http.DefaultTransport,
			xApiKey: config.GetXApiKey(),
			local:   config.RemnawaveMode() == "local",
		},
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result DeleteHWIDResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
