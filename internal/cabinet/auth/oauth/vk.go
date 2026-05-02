package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"golang.org/x/oauth2"
)

// VKProvider — OAuth 2.1 VK ID (id.vk.ru), не legacy oauth.vk.com.
// В кабинете VK создаётся приложение VK ID; redirect и client_id из настроек приложения.
//
// Документация: https://id.vk.com/about/business/go/docs/ru/vkid/latest/vk-id/connection/api-description
type VKProvider struct {
	clientID     string
	clientSecret string
	redirectURL  string
	store        *StateStore
	authCfg      *oauth2.Config // только для AuthCodeURL + PKCE на id.vk.ru/authorize
}

type VKUserInfo struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	First    string `json:"first_name"`
	Last     string `json:"last_name"`
	Nickname string `json:"screen_name"`
	Photo    string `json:"photo_200"`
}

func NewVKProvider(clientID, clientSecret, redirectURL string, store *StateStore) *VKProvider {
	authCfg := &oauth2.Config{
		ClientID:    clientID,
		RedirectURL: redirectURL,
		Scopes:      []string{"email"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://id.vk.ru/authorize",
			TokenURL: "https://id.vk.ru/oauth2/auth",
		},
	}
	return &VKProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		redirectURL:  redirectURL,
		store:        store,
		authCfg:      authCfg,
	}
}

func (p *VKProvider) Start(referralRaw string, linkAccountID int64) (*StartResult, error) {
	ref := strings.TrimSpace(referralRaw)
	if len(ref) > maxOAuthReferralLen {
		ref = ref[:maxOAuthReferralLen]
	}
	// VK ID: state ≥ 32 символов (a-z A-Z 0-9 _ -); hex из randomHex подходит.
	state, err := randomHex(24)
	if err != nil {
		return nil, fmt.Errorf("vk oauth start: gen state: %w", err)
	}
	verifier := oauth2.GenerateVerifier()
	p.store.Save(state, verifier, ref, linkAccountID)
	authURL := p.authCfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))
	return &StartResult{RedirectURL: authURL, State: state}, nil
}

func (p *VKProvider) Callback(ctx context.Context, state, code, deviceID string) (*VKUserInfo, string, int64, error) {
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return nil, "", 0, errors.New("vk oauth: missing device_id (VK ID callback)")
	}
	verifier, referralRaw, linkAccountID, ok := p.store.Pop(state)
	if !ok {
		return nil, "", 0, ErrStateInvalid
	}
	if verifier == "" {
		return nil, "", 0, errors.New("vk oauth: empty code_verifier for state")
	}
	accessToken, err := vkIDExchangeCode(ctx, p.clientID, p.clientSecret, p.redirectURL, code, verifier, deviceID, state)
	if err != nil {
		return nil, "", 0, fmt.Errorf("vk oauth exchange: %w", err)
	}
	info, err := fetchVKIDUserInfo(ctx, p.clientID, accessToken)
	if err != nil {
		return nil, "", 0, fmt.Errorf("vk userinfo: %w", err)
	}
	if info.ID <= 0 {
		return nil, "", 0, errors.New("vk userinfo: empty id")
	}
	return info, referralRaw, linkAccountID, nil
}

func vkIDExchangeCode(ctx context.Context, clientID, clientSecret, redirectURI, code, codeVerifier, deviceID, state string) (accessToken string, err error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code_verifier", codeVerifier)
	form.Set("redirect_uri", redirectURI)
	form.Set("code", code)
	form.Set("client_id", clientID)
	form.Set("device_id", deviceID)
	form.Set("state", state)
	if strings.TrimSpace(clientSecret) != "" {
		form.Set("client_secret", clientSecret)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://id.vk.ru/oauth2/auth", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tok struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		Description string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", fmt.Errorf("token decode: %w", err)
	}
	if tok.Error != "" {
		return "", fmt.Errorf("%s: %s", tok.Error, tok.Description)
	}
	if strings.TrimSpace(tok.AccessToken) == "" {
		return "", errors.New("empty access_token")
	}
	return tok.AccessToken, nil
}

type vkIDUserInfoResponse struct {
	User vkIDUserPayload `json:"user"`
}

type vkIDUserPayload struct {
	UserID    any    `json:"user_id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Avatar    string `json:"avatar"`
}

func fetchVKIDUserInfo(ctx context.Context, clientID, accessToken string) (*VKUserInfo, error) {
	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("access_token", accessToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://id.vk.ru/oauth2/user_info", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user_info status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var env vkIDUserInfoResponse
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("user_info decode: %w", err)
	}
	uid, err := toInt64(env.User.UserID)
	if err != nil || uid <= 0 {
		return nil, fmt.Errorf("user_info: bad user_id")
	}
	return &VKUserInfo{
		ID:       uid,
		Email:    strings.TrimSpace(env.User.Email),
		First:    strings.TrimSpace(env.User.FirstName),
		Last:     strings.TrimSpace(env.User.LastName),
		Nickname: "",
		Photo:    strings.TrimSpace(env.User.Avatar),
	}, nil
}

func toInt64(v any) (int64, error) {
	switch x := v.(type) {
	case int64:
		return x, nil
	case int:
		return int64(x), nil
	case float64:
		return int64(x), nil
	case string:
		return strconv.ParseInt(strings.TrimSpace(x), 10, 64)
	default:
		return 0, errors.New("unsupported type")
	}
}
