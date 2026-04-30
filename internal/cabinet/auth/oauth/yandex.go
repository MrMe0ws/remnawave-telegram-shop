package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"golang.org/x/oauth2"
)

// YandexProvider — OAuth2 provider for Yandex.
type YandexProvider struct {
	cfg   *oauth2.Config
	store *StateStore
}

type YandexUserInfo struct {
	ID            string `json:"id"`
	DefaultEmail  string `json:"default_email"`
	Email         string `json:"email"`
	Login         string `json:"login"`
	DisplayName   string `json:"display_name"`
	RealName      string `json:"real_name"`
	DefaultAvatar string `json:"default_avatar_id"`
}

func NewYandexProvider(clientID, clientSecret, redirectURL string, store *StateStore) *YandexProvider {
	cfg := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"login:email", "login:info"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://oauth.yandex.ru/authorize",
			TokenURL: "https://oauth.yandex.ru/token",
		},
	}
	return &YandexProvider{cfg: cfg, store: store}
}

func (p *YandexProvider) Start(referralRaw string, linkAccountID int64) (*StartResult, error) {
	ref := strings.TrimSpace(referralRaw)
	if len(ref) > maxOAuthReferralLen {
		ref = ref[:maxOAuthReferralLen]
	}
	state, err := randomHex(16)
	if err != nil {
		return nil, fmt.Errorf("yandex oauth start: gen state: %w", err)
	}
	verifier := oauth2.GenerateVerifier()
	p.store.Save(state, verifier, ref, linkAccountID)
	authURL := p.cfg.AuthCodeURL(state, oauth2.AccessTypeOnline, oauth2.S256ChallengeOption(verifier))
	return &StartResult{RedirectURL: authURL, State: state}, nil
}

func (p *YandexProvider) Callback(ctx context.Context, state, code string) (*YandexUserInfo, string, int64, error) {
	verifier, referralRaw, linkAccountID, ok := p.store.Pop(state)
	if !ok {
		return nil, "", 0, ErrStateInvalid
	}
	token, err := p.cfg.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, "", 0, fmt.Errorf("yandex oauth exchange: %w", err)
	}
	info, err := fetchYandexUserInfo(ctx, p.cfg, token)
	if err != nil {
		return nil, "", 0, fmt.Errorf("yandex userinfo: %w", err)
	}
	if strings.TrimSpace(info.ID) == "" {
		return nil, "", 0, errors.New("yandex userinfo: empty id")
	}
	return info, referralRaw, linkAccountID, nil
}

func fetchYandexUserInfo(ctx context.Context, cfg *oauth2.Config, token *oauth2.Token) (*YandexUserInfo, error) {
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://login.yandex.ru/info?format=json")
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo: status %d", resp.StatusCode)
	}
	var info YandexUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("userinfo: decode: %w", err)
	}
	return &info, nil
}
