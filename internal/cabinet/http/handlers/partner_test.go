package handlers

import (
	"net/http/httptest"
	"testing"
)

func strPtr(v string) *string { return &v }

// Подпись клиента — единственная защита его контакта: партнёр должен видеть,
// что человек живой, но не получать данные для увода к конкуренту.
func TestPartnerCustomerLabel(t *testing.T) {
	cases := []struct {
		name       string
		username   *string
		email      *string
		telegramID int64
		webOnly    bool
		want       string
	}{
		{"username маскируется", strPtr("mikhail_k"), strPtr("a@mail.ru"), 78123456, false, "@mi***_k"},
		{"длинное имя маскируется", strPtr("cat_tac_cat"), nil, 78123456, false, "@ca***at"},
		{"короткое имя маскируется сильнее", strPtr("bob"), nil, 78123456, false, "@b***b"},
		{"двухбуквенное имя не восстановить", strPtr("bo"), nil, 78123456, false, "@b***"},
		{"пустой username пропускается", strPtr("  "), strPtr("andrey@mail.ru"), 78123456, false, "a***y@mail.ru"},
		{"email маскируется", nil, strPtr("andrey@mail.ru"), 0, true, "a***y@mail.ru"},
		{"короткий email тоже маскируется", nil, strPtr("a@mail.ru"), 0, true, "a***@mail.ru"},
		{"без контактов — половина telegram id", nil, nil, 78123456, false, "78***56"},
		{"web-only без контактов — прочерк", nil, nil, 0, true, "—"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := partnerCustomerLabel(tc.username, tc.email, tc.telegramID, tc.webOnly)
			// MaskHalfInt64 формирует маску сам, поэтому сверяем только то, что
			// сырого id в подписи нет.
			if tc.want == "78***56" {
				if got == "78123456" {
					t.Fatalf("telegram id не замаскирован: %q", got)
				}
				return
			}
			if got != tc.want {
				t.Fatalf("partnerCustomerLabel = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestPartnerBotLink(t *testing.T) {
	cases := []struct {
		name   string
		botURL string
		code   string
		want   string
	}{
		{"полный url", "https://t.me/MyBot", "a7f3k2", "https://t.me/MyBot?start=p_a7f3k2"},
		{"хвостовой слэш", "https://t.me/MyBot/", "a7f3k2", "https://t.me/MyBot?start=p_a7f3k2"},
		{"собака вместо url", "@MyBot", "a7f3k2", "https://t.me/MyBot?start=p_a7f3k2"},
		{"http тоже поддержан", "http://t.me/MyBot", "a7f3k2", "http://t.me/MyBot?start=p_a7f3k2"},
		// Битая ссылка хуже отсутствующей: по ней переход не засчитается, и
		// партнёр будет уверен, что его обманывают со статистикой.
		{"BOT_URL не настроен", "", "a7f3k2", ""},
		{"посторонний домен", "https://example.com/bot", "a7f3k2", ""},
		{"пустой код", "https://t.me/MyBot", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := partnerBotLink(tc.botURL, tc.code); got != tc.want {
				t.Fatalf("partnerBotLink(%q, %q) = %q, want %q", tc.botURL, tc.code, got, tc.want)
			}
		})
	}
}

func TestExtractPartnerLinkID(t *testing.T) {
	cases := []struct {
		path string
		want int64
		ok   bool
	}{
		{"/cabinet/api/me/partner/links/42", 42, true},
		{"/cabinet/api/me/partner/links/42/", 42, true},
		{"/cabinet/api/me/partner/links/", 0, false},
		{"/cabinet/api/me/partner/links/abc", 0, false},
		{"/cabinet/api/me/partner/links/-1", 0, false},
		{"/cabinet/api/me/partner/links/0", 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			got, ok := extractPartnerLinkID(tc.path)
			if ok != tc.ok || got != tc.want {
				t.Fatalf("extractPartnerLinkID(%q) = (%d, %v), want (%d, %v)", tc.path, got, ok, tc.want, tc.ok)
			}
		})
	}
}

// Потолок limit защищает от запроса «отдай мне всю базу одним ответом».
func TestPaginationParams(t *testing.T) {
	cases := []struct {
		query      string
		wantLimit  int
		wantOffset int
	}{
		{"", 25, 0},
		{"?limit=10&offset=5", 10, 5},
		{"?limit=999", 100, 0},
		{"?limit=0", 25, 0},
		{"?limit=-5&offset=-5", 25, 0},
		{"?limit=abc", 25, 0},
	}
	for _, tc := range cases {
		t.Run(tc.query, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/cabinet/api/me/partner/customers"+tc.query, nil)
			limit, offset := paginationParams(r, 25, 100)
			if limit != tc.wantLimit || offset != tc.wantOffset {
				t.Fatalf("paginationParams(%q) = (%d, %d), want (%d, %d)",
					tc.query, limit, offset, tc.wantLimit, tc.wantOffset)
			}
		})
	}
}

// Сумма заявки обязана совпасть с тем, что спишется с баланса: NUMERIC(12,2) в
// базе не хранит третий знак, и без округления заявка на 100.999 списала бы 101.
func TestRoundMoney(t *testing.T) {
	cases := []struct {
		in   float64
		want float64
	}{
		{100.999, 101},
		{100.994, 100.99},
		{1196, 1196},
		{0.005, 0.01},
		{0, 0},
		// Отрицательные — ручные списания админа. Усечение к нулю давало бы
		// −99.99 вместо −100, и отмена начисления не обнуляла бы его.
		{-100, -100},
		{-1196.004, -1196},
		{-0.005, -0.01},
	}
	for _, tc := range cases {
		if got := roundMoney(tc.in); got != tc.want {
			t.Fatalf("roundMoney(%v) = %v, want %v", tc.in, got, tc.want)
		}
	}
}
