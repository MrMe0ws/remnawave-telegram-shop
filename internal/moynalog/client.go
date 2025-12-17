package moynalog

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// Client представляет клиент для работы с API МойНалог
type Client struct {
	httpClient *http.Client
	baseURL    string
	username   string
	password   string
	token      string
}

// NewClient создает новый клиент МойНалог
func NewClient(baseURL, username, password string) *Client {
	client := &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL:  baseURL,
		username: username,
		password: password,
	}

	// Автоматическая аутентификация при создании клиента
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := client.Authenticate(ctx); err != nil {
		slog.Error("Failed to authenticate moynalog client on startup", "error", err)
		// Не паникуем, чтобы не сломать запуск приложения, если МойНалог недоступен
	}

	return client
}

// Authenticate выполняет аутентификацию и сохраняет токен
func (c *Client) Authenticate(ctx context.Context) error {
	authURL := fmt.Sprintf("%s/auth/lkfl", c.baseURL)

	deviceInfo := DeviceInfo{
		SourceDeviceId: "*",
		SourceType:     "WEB",
		AppVersion:     "1.0.0",
		MetaDetails: MetaDetails{
			UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0 Safari/537.36",
		},
	}

	authRequest := AuthRequest{
		Username:   c.username,
		Password:   c.password,
		DeviceInfo: deviceInfo,
	}

	reqBody, err := json.Marshal(authRequest)
	if err != nil {
		return fmt.Errorf("failed to marshal auth request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", authURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("error reading response body: %w", err)
		}
		return fmt.Errorf("authentication failed with status %d: %s", resp.StatusCode, string(body))
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return fmt.Errorf("failed to decode auth response: %w", err)
	}

	c.token = authResp.Token

	slog.Info("Moynalog client authenticated successfully")
	return nil
}

// ensureAuthenticated проверяет и обновляет токен при необходимости
func (c *Client) ensureAuthenticated(ctx context.Context) error {
	// Если токен пустой, обновляем его
	if c.token == "" {
		return c.Authenticate(ctx)
	}
	return nil
}

// CreateIncome создает чек о доходе
func (c *Client) CreateIncome(ctx context.Context, amount float64, description string) error {
	if err := c.ensureAuthenticated(ctx); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	incomeURL := fmt.Sprintf("%s/income", c.baseURL)

	formattedTime := getFormattedTime()

	service := Service{
		Name:     description,
		Amount:   amount,
		Quantity: 1,
	}

	client := IncomeClient{
		ContactPhone: nil,
		DisplayName:  nil,
		INN:          nil,
		IncomeType:   "FROM_INDIVIDUAL",
	}

	incomeRequest := CreateIncomeRequest{
		OperationTime:                   parseTimeString(formattedTime),
		RequestTime:                     parseTimeString(formattedTime),
		Services:                        []Service{service},
		TotalAmount:                     fmt.Sprintf("%.2f", amount),
		Client:                          client,
		PaymentType:                     "CASH",
		IgnoreMaxTotalIncomeRestriction: false,
	}

	reqBody, err := json.Marshal(incomeRequest)
	if err != nil {
		return fmt.Errorf("failed to marshal income request: %w", err)
	}

	errTokenExpired := errors.New("moynalog token expired")

	doSend := func() error {
		req, err := http.NewRequestWithContext(ctx, "POST", incomeURL, bytes.NewBuffer(reqBody))
		if err != nil {
			return fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.token))
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("failed to send request: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusUnauthorized {
			return errTokenExpired
		}

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			body, err := io.ReadAll(resp.Body)
			if err != nil {
				return fmt.Errorf("error reading response body: %w", err)
			}
			return fmt.Errorf("create income failed with status %d: %s", resp.StatusCode, string(body))
		}

		var incomeResp CreateIncomeResponse
		if err := json.NewDecoder(resp.Body).Decode(&incomeResp); err != nil {
			return fmt.Errorf("failed to decode income response: %w", err)
		}

		slog.Info("Income receipt created successfully", "id", incomeResp.ID, "amount", amount)
		return nil
	}

	// Первая попытка
	if err := doSend(); err != nil {
		if errors.Is(err, errTokenExpired) {
			if authErr := c.Authenticate(ctx); authErr != nil {
				return fmt.Errorf("reauthentication failed after token expiration: %w", authErr)
			}
			if retryErr := doSend(); retryErr != nil {
				return fmt.Errorf("create income failed after reauthentication: %w", retryErr)
			}
			return nil
		}
		return err
	}

	return nil
}

func parseTimeString(timeStr string) time.Time {
	t, err := time.Parse("2006-01-02T15:04:05-07:00", timeStr)
	if err != nil {
		// Если формат не соответствует, пробуем другой формат
		t, err = time.Parse("2006-01-02T15:04:05", timeStr)
		if err != nil {
			// Если оба формата не подходят, возвращаем текущее время
			return time.Now()
		}
	}
	return t
}

func getFormattedTime() string {
	return time.Now().Format("2006-01-02T15:04:05-07:00")
}
