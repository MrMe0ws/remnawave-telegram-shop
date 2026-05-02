package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"golang.org/x/oauth2"
)

type VKProvider struct {
	cfg   *oauth2.Config
	store *StateStore
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
	cfg := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"email"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://oauth.vk.com/authorize",
			TokenURL: "https://oauth.vk.com/access_token",
		},
	}
	return &VKProvider{cfg: cfg, store: store}
}

func (p *VKProvider) Start(referralRaw string, linkAccountID int64) (*StartResult, error) {
	ref := strings.TrimSpace(referralRaw)
	if len(ref) > maxOAuthReferralLen {
		ref = ref[:maxOAuthReferralLen]
	}
	state, err := randomHex(16)
	if err != nil {
		return nil, fmt.Errorf("vk oauth start: gen state: %w", err)
	}
	// VK OAuth с client_secret — «server-side» приложение; PKCE в authorize
	// не поддерживается (invalid_request: PKCE is unsupported for server-side authorization).
	p.store.Save(state, "", ref, linkAccountID)
	authURL := p.cfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	return &StartResult{RedirectURL: authURL, State: state}, nil
}

func (p *VKProvider) Callback(ctx context.Context, state, code string) (*VKUserInfo, string, int64, error) {
	_, referralRaw, linkAccountID, ok := p.store.Pop(state)
	if !ok {
		return nil, "", 0, ErrStateInvalid
	}
	token, err := p.cfg.Exchange(ctx, code)
	if err != nil {
		return nil, "", 0, fmt.Errorf("vk oauth exchange: %w", err)
	}
	info, err := fetchVKUserInfo(ctx, p.cfg, token)
	if err != nil {
		return nil, "", 0, fmt.Errorf("vk userinfo: %w", err)
	}
	if info.ID <= 0 {
		return nil, "", 0, errors.New("vk userinfo: empty id")
	}
	return info, referralRaw, linkAccountID, nil
}

type vkUsersResponse struct {
	Response []VKUserInfo `json:"response"`
}

func fetchVKUserInfo(ctx context.Context, cfg *oauth2.Config, token *oauth2.Token) (*VKUserInfo, error) {
	rawUID := token.Extra("user_id")
	uid, err := toInt64(rawUID)
	if err != nil || uid <= 0 {
		return nil, fmt.Errorf("vk token: missing user_id")
	}
	email, _ := token.Extra("email").(string)

	client := cfg.Client(ctx, token)
	q := url.Values{}
	q.Set("user_ids", strconv.FormatInt(uid, 10))
	q.Set("fields", "screen_name,photo_200")
	q.Set("v", "5.199")
	resp, err := client.Get("https://api.vk.com/method/users.get?" + q.Encode())
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("users.get: status %d", resp.StatusCode)
	}
	var data vkUsersResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("users.get decode: %w", err)
	}
	if len(data.Response) == 0 {
		return nil, errors.New("vk users.get: empty response")
	}
	out := data.Response[0]
	out.Email = strings.TrimSpace(email)
	return &out, nil
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
