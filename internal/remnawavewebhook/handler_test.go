package remnawavewebhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

type fakeTM struct{}

func (fakeTM) GetText(_, key string) string {
	if key == "torrent_blocked" {
		return "⛔️ <b>Сервер «%s» временно заблокирован</b>\n\n⏱️ Блокировка на %d минут\n🔓 Снова доступен: %s в %s\n\n⚠️ <b>Не используйте торренты</b>"
	}
	return key
}

func (fakeTM) WithButton(_, key string, btn models.InlineKeyboardButton) models.InlineKeyboardButton {
	if btn.Text == "" {
		btn.Text = key
	}
	return btn
}

type fakeBot struct {
	mu   sync.Mutex
	msgs []*bot.SendMessageParams
}

func (f *fakeBot) SendMessage(_ context.Context, params *bot.SendMessageParams) (*models.Message, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	cp := *params
	f.msgs = append(f.msgs, &cp)
	return &models.Message{}, nil
}

func signedRequest(t *testing.T, secret string, body []byte) *http.Request {
	t.Helper()
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))
	req := httptest.NewRequest(http.MethodPost, "/remnawave-webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Remnawave-Signature", sig)
	req.Header.Set("X-Remnawave-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	return req
}

func TestHandler_RejectsBadSignature(t *testing.T) {
	h := NewHandler("secret", nil, &fakeBot{}, fakeTM{})
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader([]byte(`{"event":"x"}`)))
	req.Header.Set("X-Remnawave-Signature", "bad")
	req.Header.Set("X-Remnawave-Timestamp", strconv.FormatInt(time.Now().Unix(), 10))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("status %d", rr.Code)
	}
}

func TestHandler_IgnoresOtherEvents(t *testing.T) {
	secret := "secret"
	body := []byte(`{"scope":"user","event":"user.created","data":{}}`)
	h := NewHandler(secret, nil, &fakeBot{}, fakeTM{})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, signedRequest(t, secret, body))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), `"ignored":true`) {
		t.Fatalf("body %s", rr.Body.String())
	}
}

func TestHandler_NotifiesOnTorrentReport(t *testing.T) {
	secret := "secret"
	fb := &fakeBot{}
	h := NewHandler(secret, nil, fb, fakeTM{})
	const userID int64 = 4242
	h.resolveCustomer = func(_ context.Context, u remnawave.User) (*database.Customer, error) {
		if u.ID != userID {
			t.Fatalf("unexpected user id %d", u.ID)
		}
		return &database.Customer{ID: 42, TelegramID: 694614437, Language: "ru"}, nil
	}

	processed := time.Now().UTC().Truncate(time.Second)
	unblock := processed.Add(60 * time.Minute)
	payload := map[string]any{
		"scope": "torrent_blocker",
		"event": "torrent_blocker.report",
		"data": map[string]any{
			"node": map[string]any{"uuid": "node-1", "name": "Латвия"},
			"user": map[string]any{
				"id":         userID,
				"username":   "42_694614437",
				"telegramId": 694614437,
			},
			"report": map[string]any{
				"actionReport": map[string]any{
					"blocked":       true,
					"ip":            "213.59.139.63",
					"blockDuration": 3600,
					"willUnblockAt": unblock.Format(time.RFC3339Nano),
					"userId":        "42",
					"processedAt":   processed.Format(time.RFC3339Nano),
				},
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, signedRequest(t, secret, body))
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rr.Code, rr.Body.String())
	}

	fb.mu.Lock()
	defer fb.mu.Unlock()
	if len(fb.msgs) != 1 {
		t.Fatalf("messages=%d", len(fb.msgs))
	}
	msg := fb.msgs[0]
	if msg.ChatID != int64(694614437) {
		t.Fatalf("chat %v", msg.ChatID)
	}
	if !strings.Contains(msg.Text, "Латвия") || !strings.Contains(msg.Text, "60 минут") {
		t.Fatalf("text %s", msg.Text)
	}
	if msg.ReplyMarkup == nil {
		t.Fatal("expected keyboard")
	}

	// Dedup: second identical request must not send again.
	rr2 := httptest.NewRecorder()
	h.ServeHTTP(rr2, signedRequest(t, secret, body))
	if len(fb.msgs) != 1 {
		t.Fatalf("dedup failed, messages=%d", len(fb.msgs))
	}
}
