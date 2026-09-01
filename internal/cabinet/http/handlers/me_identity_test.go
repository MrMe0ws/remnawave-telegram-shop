package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

func ptrStr(s string) *string { return &s }

func TestPickTelegramID(t *testing.T) {
	realCustomer := &database.Customer{TelegramID: 777}
	webOnly := &database.Customer{TelegramID: utils.SyntheticTelegramID(5), IsWebOnly: true}
	synthetic := &database.Customer{TelegramID: utils.SyntheticTelegramID(5)}

	tests := []struct {
		name        string
		identityIDs []int64
		cust        *database.Customer
		want        *int64
	}{
		{name: "нет ничего", want: nil},
		{name: "только identity", identityIDs: []int64{111}, want: ptrInt64(111)},
		{name: "только customer", cust: realCustomer, want: ptrInt64(777)},
		{
			name:        "customer выигрывает, если такая привязка есть",
			identityIDs: []int64{111, 777},
			cust:        realCustomer,
			want:        ptrInt64(777),
		},
		{
			name:        "чужой customer не подменяет identity",
			identityIDs: []int64{111},
			cust:        realCustomer,
			want:        ptrInt64(111),
		},
		{name: "web-only не даёт telegram id", cust: webOnly, want: nil},
		{name: "синтетический id не даёт telegram id", cust: synthetic, want: nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := pickTelegramID(tc.identityIDs, tc.cust)
			switch {
			case tc.want == nil && got != nil:
				t.Fatalf("got %d, want nil", *got)
			case tc.want != nil && got == nil:
				t.Fatalf("got nil, want %d", *tc.want)
			case tc.want != nil && *got != *tc.want:
				t.Fatalf("got %d, want %d", *got, *tc.want)
			}
		})
	}
}

func ptrInt64(v int64) *int64 { return &v }

func TestParseOAuthProfile(t *testing.T) {
	tests := []struct {
		provider   string
		raw        string
		wantName   string
		wantAvatar string
	}{
		{
			provider:   repository.ProviderGoogle,
			raw:        `{"sub":"1","name":"Chingiz G.","picture":"https://lh3.googleusercontent.com/a/x"}`,
			wantName:   "Chingiz G.",
			wantAvatar: "https://lh3.googleusercontent.com/a/x",
		},
		{
			provider:   repository.ProviderYandex,
			raw:        `{"display_name":"Мяус","default_avatar_id":"abc123"}`,
			wantName:   "Мяус",
			wantAvatar: "https://avatars.yandex.net/get-yapic/abc123/islands-200",
		},
		{
			provider: repository.ProviderYandex,
			// Идентификатор картинки подставляется в URL — путь в нём недопустим.
			raw:        `{"display_name":"Мяус","default_avatar_id":"../../evil"}`,
			wantName:   "Мяус",
			wantAvatar: "",
		},
		{
			provider:   repository.ProviderVK,
			raw:        `{"first_name":"Мяус","last_name":"Котов","photo_200":"https://vk.com/p.jpg"}`,
			wantName:   "Мяус Котов",
			wantAvatar: "https://vk.com/p.jpg",
		},
		{
			provider: repository.ProviderGoogle,
			// http и javascript: не должны доехать до src картинки.
			raw:        `{"name":"X","picture":"http://insecure/pic.jpg"}`,
			wantName:   "X",
			wantAvatar: "",
		},
		{provider: repository.ProviderGoogle, raw: `not json`},
	}
	for _, tc := range tests {
		t.Run(tc.provider+"/"+tc.raw[:min(len(tc.raw), 24)], func(t *testing.T) {
			name, avatar := parseOAuthProfile(tc.provider, []byte(tc.raw))
			if name != tc.wantName {
				t.Fatalf("name = %q, want %q", name, tc.wantName)
			}
			if avatar != tc.wantAvatar {
				t.Fatalf("avatar = %q, want %q", avatar, tc.wantAvatar)
			}
		})
	}
}

// Бот в тестах не поднят (tgProfiles == nil), поэтому проверяются именно
// запасные пути: они же работают, когда Telegram недоступен в проде.
func TestResolveIdentityProfileFallbacks(t *testing.T) {
	h := &MeHandler{avatarSecret: []byte("secret")}
	ctx := context.Background()

	t.Run("telegram привязан, бот молчит — ник из customer", func(t *testing.T) {
		ids := []repository.Identity{{Provider: repository.ProviderTelegram, ProviderUserID: "777"}}
		cust := &database.Customer{TelegramID: 777, TelegramUsername: ptrStr("@MrMeows")}
		got := h.resolveIdentityProfile(ctx, 1, ids, cust, ptrInt64(777))
		if got.Username != "MrMeows" {
			t.Fatalf("username = %q, want MrMeows", got.Username)
		}
		if got.Provider != repository.ProviderTelegram {
			t.Fatalf("provider = %q, want telegram", got.Provider)
		}
		if got.AvatarURL != "" {
			t.Fatalf("avatar = %q, want empty", got.AvatarURL)
		}
	})

	t.Run("telegram без имени добирает имя из google", func(t *testing.T) {
		ids := []repository.Identity{
			{Provider: repository.ProviderTelegram, ProviderUserID: "777"},
			{Provider: repository.ProviderGoogle, RawProfileJSON: []byte(`{"name":"Chingiz G.","picture":"https://pic/x"}`)},
		}
		got := h.resolveIdentityProfile(ctx, 1, ids, nil, ptrInt64(777))
		if got.DisplayName != "Chingiz G." {
			t.Fatalf("name = %q, want Chingiz G.", got.DisplayName)
		}
		// Бейдж остаётся телеграмным: это способ входа, а не источник картинки.
		if got.Provider != repository.ProviderTelegram {
			t.Fatalf("provider = %q, want telegram", got.Provider)
		}
	})

	t.Run("имя из identity, если оно там сохранено", func(t *testing.T) {
		ids := []repository.Identity{{
			Provider:       repository.ProviderTelegram,
			ProviderUserID: "777",
			RawProfileJSON: []byte(`{"id":777,"username":"MrMeows","first_name":"Мяус"}`),
		}}
		got := h.resolveIdentityProfile(ctx, 1, ids, nil, ptrInt64(777))
		if got.DisplayName != "Мяус" {
			t.Fatalf("name = %q, want Мяус", got.DisplayName)
		}
	})

	t.Run("без telegram — целиком google", func(t *testing.T) {
		ids := []repository.Identity{
			{Provider: repository.ProviderGoogle, RawProfileJSON: []byte(`{"name":"Chingiz G.","picture":"https://pic/x"}`)},
		}
		got := h.resolveIdentityProfile(ctx, 1, ids, nil, nil)
		if got.DisplayName != "Chingiz G." || got.AvatarURL != "https://pic/x" {
			t.Fatalf("got %+v", got)
		}
		if got.Provider != repository.ProviderGoogle {
			t.Fatalf("provider = %q, want google", got.Provider)
		}
	})

	t.Run("пустой аккаунт", func(t *testing.T) {
		got := h.resolveIdentityProfile(ctx, 1, nil, nil, nil)
		if got.DisplayName != "" || got.Username != "" || got.AvatarURL != "" || got.Provider != "" {
			t.Fatalf("got %+v, want zero", got)
		}
	})
}

func TestMatchesETag(t *testing.T) {
	const etag = `"tg-abc"`
	for _, header := range []string{etag, `W/` + etag, `"other", ` + etag, "*"} {
		if !matchesETag(header, etag) {
			t.Fatalf("header %q should match", header)
		}
	}
	for _, header := range []string{"", `"other"`, strings.TrimSuffix(etag, `"`)} {
		if matchesETag(header, etag) {
			t.Fatalf("header %q should not match", header)
		}
	}
}

// Поля шапки embedded-структурой, поэтому в JSON они должны лежать плоско
// рядом с остальным /me, а не вложенным объектом.
func TestMeRespInlinesIdentityProfile(t *testing.T) {
	body, err := json.Marshal(meResp{
		ID:              7,
		identityProfile: identityProfile{DisplayName: "Мяус", Username: "MrMeows", Provider: "telegram"},
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var flat map[string]any
	if err := json.Unmarshal(body, &flat); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for key, want := range map[string]string{
		"display_name":      "Мяус",
		"username":          "MrMeows",
		"identity_provider": "telegram",
	} {
		if got, _ := flat[key].(string); got != want {
			t.Fatalf("%s = %q, want %q", key, got, want)
		}
	}
}
