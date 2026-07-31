package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/net/proxy"
)

const telegramMaxMessageRunes = 4096

type telegramConfig struct {
	Token           string
	ChatID          string
	MessageThreadID int
	Footer          TelegramFooter
	ProxyURL        string
}

type sendMessageRequest struct {
	ChatID                string `json:"chat_id"`
	Text                  string `json:"text"`
	ParseMode             string `json:"parse_mode"`
	DisableWebPagePreview bool   `json:"disable_web_page_preview"`
	MessageThreadID       int    `json:"message_thread_id,omitempty"`
}

type telegramAPIResponse struct {
	OK          bool            `json:"ok"`
	Description string          `json:"description"`
	Result      json.RawMessage `json:"result"`
}

func sendTelegramHTML(cfg telegramConfig, html string) error {
	if strings.TrimSpace(cfg.Token) == "" {
		return fmt.Errorf("RELEASE_TG_BOT_TOKEN is empty")
	}
	if strings.TrimSpace(cfg.ChatID) == "" {
		return fmt.Errorf("RELEASE_TG_CHAT_ID is empty")
	}
	if strings.TrimSpace(html) == "" {
		return fmt.Errorf("telegram message is empty")
	}
	if n := utf8.RuneCountInString(html); n > telegramMaxMessageRunes {
		return fmt.Errorf("telegram message is %d runes (limit %d); shorten Telegram section in RELEASE_NOTES.md", n, telegramMaxMessageRunes)
	}

	reqBody := sendMessageRequest{
		ChatID:                cfg.ChatID,
		Text:                  html,
		ParseMode:             "HTML",
		DisableWebPagePreview: true,
	}
	if cfg.MessageThreadID > 0 {
		reqBody.MessageThreadID = cfg.MessageThreadID
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal telegram request: %w", err)
	}

	client, err := newTelegramHTTPClient(cfg.ProxyURL)
	if err != nil {
		return err
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", cfg.Token)
	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		// Do not wrap net/http error: it embeds the full URL with bot token.
		return fmt.Errorf("telegram sendMessage failed (proxy=%q): %s", emptyAs(cfg.ProxyURL, "none"), sanitizeDialError(err))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read telegram response: %w", err)
	}

	var apiResp telegramAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return fmt.Errorf("decode telegram response: %w (status=%d body=%s)", err, resp.StatusCode, truncate(string(body), 200))
	}
	if !apiResp.OK {
		return fmt.Errorf("telegram API error: %s", apiResp.Description)
	}
	return nil
}

func newTelegramHTTPClient(proxyURL string) (*http.Client, error) {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
	}
	proxyURL = strings.TrimSpace(proxyURL)
	if proxyURL != "" {
		parsed, err := url.Parse(proxyURL)
		if err != nil {
			return nil, fmt.Errorf("RELEASE_TG_PROXY_URL: %w", err)
		}
		switch strings.ToLower(parsed.Scheme) {
		case "http", "https":
			transport.Proxy = http.ProxyURL(parsed)
		case "socks5", "socks5h":
			var auth *proxy.Auth
			if parsed.User != nil {
				pass, _ := parsed.User.Password()
				auth = &proxy.Auth{
					User:     parsed.User.Username(),
					Password: pass,
				}
			}
			dialer, err := proxy.SOCKS5("tcp", parsed.Host, auth, proxy.Direct)
			if err != nil {
				return nil, fmt.Errorf("RELEASE_TG_PROXY_URL socks5: %w", err)
			}
			transport.Proxy = nil
			if ctxDialer, ok := dialer.(proxy.ContextDialer); ok {
				transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
					return ctxDialer.DialContext(ctx, network, addr)
				}
			} else {
				transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				}
			}
		default:
			return nil, fmt.Errorf("RELEASE_TG_PROXY_URL: unsupported scheme %q (use http/https/socks5)", parsed.Scheme)
		}
	}
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}, nil
}

func sanitizeDialError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	// Strip accidental token leakage if present.
	if i := strings.Index(msg, "/bot"); i >= 0 {
		rest := msg[i+4:]
		if j := strings.Index(rest, "/"); j >= 0 {
			msg = msg[:i+4] + "<redacted>" + rest[j:]
		}
	}
	return msg
}

func parseThreadID(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	id, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("RELEASE_TG_MESSAGE_THREAD_ID: %w", err)
	}
	if id < 0 {
		return 0, fmt.Errorf("RELEASE_TG_MESSAGE_THREAD_ID must be >= 0")
	}
	return id, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
