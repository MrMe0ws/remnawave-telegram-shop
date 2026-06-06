package supportbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultTimeout = 15 * time.Second

type Client struct {
	baseURL    string
	secret     string
	httpClient *http.Client
}

func NewClient(baseURL, secret string) *Client {
	return &Client{
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		secret:  strings.TrimSpace(secret),
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

type PostMessageRequest struct {
	AccountID           int64   `json:"account_id"`
	ShopTicketID        int64   `json:"shop_ticket_id"`
	IsNewTicket         bool    `json:"is_new_ticket"`
	ClientMessageID     string  `json:"client_message_id"` // UUID idempotency key
	DisplayName         string  `json:"display_name"`
	TelegramID          *int64  `json:"telegram_id,omitempty"`
	TelegramLabel       string  `json:"telegram_label"`
	Email               string  `json:"email"`
	SubscriptionSummary string  `json:"subscription_summary"`
	Text                string  `json:"text"`
}

type PostMessageResponse struct {
	SupportBotTicketID int64 `json:"support_bot_ticket_id"`
	ThreadID           int64 `json:"thread_id"`
}

func (c *Client) PostCabinetMessage(ctx context.Context, req PostMessageRequest) (*PostMessageResponse, error) {
	if c == nil || c.baseURL == "" {
		return nil, fmt.Errorf("supportbot: client not configured")
	}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/internal/cabinet/message", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.secret)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("supportbot: request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supportbot: status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	var out PostMessageResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, fmt.Errorf("supportbot: decode response: %w", err)
	}
	return &out, nil
}
