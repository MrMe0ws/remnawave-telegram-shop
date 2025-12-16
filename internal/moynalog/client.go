package moynalog

import (
	"bytes"
	"context"
	"encoding/json"
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
	tokenExp   time.Time
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
	authURL := fmt.Sprintf("%s/api/auth", c.baseURL)

	authReq := AuthRequest{
		Username: c.username,
		Password: c.password,
	}

	reqBody, err := json.Marshal(authReq)
	if err != nil {
		return fmt.Errorf("failed to marshal auth request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", authURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("authentication failed. Status: %d, Body: %s", resp.StatusCode, string(body))
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	c.token = authResp.Token
	c.tokenExp = authResp.ExpiresAt

	slog.Info("Moynalog client authenticated successfully", "expires_at", authResp.ExpiresAt)
	return nil
}

// ensureAuthenticated проверяет и обновляет токен при необходимости
func (c *Client) ensureAuthenticated(ctx context.Context) error {
	// Если токен истекает в течение 5 минут, обновляем его
	if c.token == "" || time.Until(c.tokenExp) < 5*time.Minute {
		return c.Authenticate(ctx)
	}
	return nil
}

// CreateIncome создает чек о доходе
func (c *Client) CreateIncome(ctx context.Context, amount float64, description string) error {
	if err := c.ensureAuthenticated(ctx); err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	incomeURL := fmt.Sprintf("%s/api/income", c.baseURL)

	incomeReq := CreateIncomeRequest{
		Amount:      amount,
		Description: description,
		Date:        time.Now().Format("2006-01-02"),
	}

	reqBody, err := json.Marshal(incomeReq)
	if err != nil {
		return fmt.Errorf("failed to marshal income request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", incomeURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.token))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create income receipt. Status: %d, Body: %s", resp.StatusCode, string(body))
	}

	var incomeResp CreateIncomeResponse
	if err := json.NewDecoder(resp.Body).Decode(&incomeResp); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	slog.Info("Income receipt created successfully", "id", incomeResp.ID, "amount", amount)
	return nil
}
