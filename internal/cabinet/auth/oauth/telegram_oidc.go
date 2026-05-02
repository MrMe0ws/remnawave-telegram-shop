package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

const telegramOIDCStateTTL = 10 * time.Minute

type TelegramOIDCMode string

const (
	TelegramOIDCModeLogin TelegramOIDCMode = "login"
	TelegramOIDCModeLink  TelegramOIDCMode = "link"
)

type telegramOIDCState struct {
	Verifier    string
	Mode        TelegramOIDCMode
	ReferralRaw string
	AccountID   int64
	ExpiresAt   time.Time
}

type TelegramOIDCStateStore struct {
	mu    sync.Mutex
	store map[string]telegramOIDCState
}

func NewTelegramOIDCStateStore() *TelegramOIDCStateStore {
	return &TelegramOIDCStateStore{store: map[string]telegramOIDCState{}}
}

func (s *TelegramOIDCStateStore) Save(state string, v telegramOIDCState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store[state] = v
}

func (s *TelegramOIDCStateStore) Pop(state string) (telegramOIDCState, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.store[state]
	if !ok {
		return telegramOIDCState{}, false
	}
	delete(s.store, state)
	if time.Now().After(v.ExpiresAt) {
		return telegramOIDCState{}, false
	}
	return v, true
}

func (s *TelegramOIDCStateStore) RunGC(ctx context.Context) {
	go func() {
		t := time.NewTicker(time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				now := time.Now()
				s.mu.Lock()
				for k, v := range s.store {
					if now.After(v.ExpiresAt) {
						delete(s.store, k)
					}
				}
				s.mu.Unlock()
			}
		}
	}()
}

type TelegramOIDCProvider struct {
	clientID     string
	clientSecret string
	redirectURL  string
	store        *TelegramOIDCStateStore
	httpClient   *http.Client
}

func (p *TelegramOIDCProvider) RunGC(ctx context.Context) {
	if p == nil || p.store == nil {
		return
	}
	p.store.RunGC(ctx)
}

type TelegramOIDCStartInput struct {
	Mode        TelegramOIDCMode
	ReferralRaw string
	AccountID   int64
}

type TelegramOIDCStartResult struct {
	RedirectURL string
	State       string
}

type TelegramOIDCCallbackResult struct {
	Mode        TelegramOIDCMode
	ReferralRaw string
	AccountID   int64
	TelegramID  int64
	Username    string
}

const maxPlausibleTelegramUserID int64 = 9_999_999_999_999

func NewTelegramOIDCProvider(clientID, clientSecret, redirectURL string, store *TelegramOIDCStateStore) *TelegramOIDCProvider {
	return &TelegramOIDCProvider{
		clientID:     strings.TrimSpace(clientID),
		clientSecret: strings.TrimSpace(clientSecret),
		redirectURL:  strings.TrimSpace(redirectURL),
		store:        store,
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (p *TelegramOIDCProvider) Start(in TelegramOIDCStartInput) (*TelegramOIDCStartResult, error) {
	if p.clientID == "" || p.clientSecret == "" || p.redirectURL == "" {
		return nil, errors.New("telegram oidc: not configured")
	}
	if in.Mode == "" {
		in.Mode = TelegramOIDCModeLogin
	}
	state, err := randomHex(16)
	if err != nil {
		return nil, err
	}
	verifier := oauth2.GenerateVerifier()
	challenge := oauth2.S256ChallengeFromVerifier(verifier)
	p.store.Save(state, telegramOIDCState{
		Verifier:    verifier,
		Mode:        in.Mode,
		ReferralRaw: strings.TrimSpace(in.ReferralRaw),
		AccountID:   in.AccountID,
		ExpiresAt:   time.Now().Add(telegramOIDCStateTTL),
	})

	q := url.Values{}
	q.Set("client_id", p.clientID)
	q.Set("redirect_uri", p.redirectURL)
	q.Set("response_type", "code")
	q.Set("scope", "openid profile")
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")

	return &TelegramOIDCStartResult{
		State:       state,
		RedirectURL: "https://oauth.telegram.org/auth?" + q.Encode(),
	}, nil
}

func (p *TelegramOIDCProvider) Callback(ctx context.Context, state, code string) (*TelegramOIDCCallbackResult, error) {
	st, ok := p.store.Pop(strings.TrimSpace(state))
	if !ok {
		return nil, errors.New("telegram oidc: invalid state")
	}
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", p.redirectURL)
	form.Set("client_id", p.clientID)
	form.Set("code_verifier", st.Verifier)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth.telegram.org/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.SetBasicAuth(p.clientID, p.clientSecret)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("telegram oidc token status %d: %s", resp.StatusCode, string(b))
	}
	var tok struct {
		IDToken string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return nil, err
	}
	if strings.TrimSpace(tok.IDToken) == "" {
		return nil, errors.New("telegram oidc: empty id_token")
	}

	parsed, _, err := new(jwt.Parser).ParseUnverified(tok.IDToken, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("telegram oidc parse id_token: %w", err)
	}
	var claims struct {
		Sub               string
		PreferredUsername string
		Username          string
		TelegramID        int64
	}
	if mc, ok := parsed.Claims.(jwt.MapClaims); ok {
		if v, ok := mc["sub"].(string); ok {
			claims.Sub = v
		}
		if v, ok := mc["preferred_username"].(string); ok {
			claims.PreferredUsername = v
		}
		if v, ok := mc["username"].(string); ok {
			claims.Username = v
		}
		if id, ok := extractTelegramID(mc); ok {
			claims.TelegramID = id
		}
	}

	tgID := claims.TelegramID
	if tgID <= 0 {
		// Fallback: в некоторых ответах Telegram ID может приходить в sub.
		parsedSub, perr := strconv.ParseInt(claims.Sub, 10, 64)
		if perr == nil && parsedSub > 0 && parsedSub <= maxPlausibleTelegramUserID {
			tgID = parsedSub
		}
	}
	if tgID <= 0 {
		return nil, fmt.Errorf("telegram oidc: cannot extract telegram user id (sub=%q)", claims.Sub)
	}
	username := strings.TrimSpace(claims.PreferredUsername)
	if username == "" {
		username = strings.TrimSpace(claims.Username)
	}

	return &TelegramOIDCCallbackResult{
		Mode:        st.Mode,
		ReferralRaw: st.ReferralRaw,
		AccountID:   st.AccountID,
		TelegramID:  tgID,
		Username:    username,
	}, nil
}

func extractTelegramID(mc jwt.MapClaims) (int64, bool) {
	for _, key := range []string{"telegram_id", "user_id", "id"} {
		v, ok := mc[key]
		if !ok {
			continue
		}
		if id, ok := parseNumericClaim(v); ok && id > 0 && id <= maxPlausibleTelegramUserID {
			return id, true
		}
	}
	return 0, false
}

func parseNumericClaim(v any) (int64, bool) {
	switch t := v.(type) {
	case float64:
		if t <= 0 || t > float64(math.MaxInt64) || math.Trunc(t) != t {
			return 0, false
		}
		return int64(t), true
	case json.Number:
		n, err := t.Int64()
		return n, err == nil
	case string:
		s := strings.TrimSpace(t)
		if s == "" {
			return 0, false
		}
		n, err := strconv.ParseInt(s, 10, 64)
		return n, err == nil
	default:
		return 0, false
	}
}
