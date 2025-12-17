package moynalog

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

var (
	ErrAuth      = errors.New("authentication error")
	ErrRetryable = errors.New("retryable error")
	ErrClient    = errors.New("client error")
)

// Client представляет клиент для работы с API МойНалог
type Client struct {
	httpClient *http.Client
	baseURL    string

	username string
	password string

	token atomic.Value

	authMu       sync.Mutex
	authInFlight bool
	authCond     *sync.Cond
}

// NewClient создает новый клиент МойНалог
func NewClient(baseURL, username, password string) *Client {
	c := &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL:  baseURL,
		username: username,
		password: password,
	}
	c.authCond = sync.NewCond(&c.authMu)

	// Автоматическая аутентификация при создании клиента
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := c.Authenticate(ctx); err != nil {
		slog.Error("Failed to authenticate moynalog client on startup", "error", err)
		// Не паникуем, чтобы не сломать запуск приложения, если МойНалог недоступен
	}

	return c
}

// Authenticate выполняет аутентификацию и сохраняет токен
func (c *Client) Authenticate(ctx context.Context) error {
	c.authMu.Lock()
	defer c.authMu.Unlock()

	// Если уже идет авторизация, ждем её завершения
	for c.authInFlight {
		c.authCond.Wait()
	}

	// Проверяем, не авторизовались ли мы пока ждали
	if token := c.token.Load(); token != nil && token.(string) != "" {
		return nil
	}

	c.authInFlight = true
	defer func() {
		c.authInFlight = false
		c.authCond.Broadcast()
	}()

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

	c.token.Store(authResp.Token)

	slog.Info("Moynalog client authenticated successfully")
	return nil
}

// ensureAuthenticated проверяет и обновляет токен при необходимости
func (c *Client) ensureAuthenticated(ctx context.Context) error {
	if token := c.token.Load(); token != nil && token.(string) != "" {
		return nil
	}

	return c.Authenticate(ctx)
}

// isRetryableError проверяет, можно ли повторить запрос при этой ошибке
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout() || netErr.Temporary()
	}

	return errors.Is(err, ErrRetryable) || errors.Is(err, ErrAuth)
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

	maxRetries := 2
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Небольшая задержка перед повтором
			time.Sleep(time.Second)
		}

		err := c.sendIncomeRequest(ctx, incomeURL, reqBody, amount)
		if err == nil {
			return nil
		}

		// Если это ошибка авторизации, пытаемся переавторизоваться
		if errors.Is(err, ErrAuth) {
			if authErr := c.Authenticate(ctx); authErr != nil {
				return fmt.Errorf("reauthentication failed: %w", authErr)
			}
			// Продолжаем цикл для повторной попытки
			continue
		}

		// Если это retryable ошибка и не последняя попытка, продолжаем
		if isRetryableError(err) && attempt < maxRetries-1 {
			continue
		}

		// Если это не retryable ошибка или последняя попытка, возвращаем ошибку
		return err
	}

	return fmt.Errorf("failed to create income after %d attempts", maxRetries)
}

// sendIncomeRequest отправляет запрос на создание чека
func (c *Client) sendIncomeRequest(ctx context.Context, incomeURL string, reqBody []byte, amount float64) error {
	token := c.token.Load()
	if token == nil {
		return fmt.Errorf("%w: token is empty", ErrAuth)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", incomeURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.(string)))
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Проверяем сетевые ошибки
		var netErr net.Error
		if errors.As(err, &netErr) {
			if netErr.Timeout() || netErr.Temporary() {
				return fmt.Errorf("%w: %w", ErrRetryable, err)
			}
		}
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return fmt.Errorf("%w: status %d", ErrAuth, resp.StatusCode)

	case resp.StatusCode >= 500:
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%w: status %d: %s", ErrRetryable, resp.StatusCode, b)

	case resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated:
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%w: status %d: %s", ErrClient, resp.StatusCode, b)
	}

	var incomeResp CreateIncomeResponse
	if err := json.NewDecoder(resp.Body).Decode(&incomeResp); err != nil {
		return err
	}

	slog.Info("Income receipt created successfully", "id", incomeResp.ID, "amount", amount)
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
