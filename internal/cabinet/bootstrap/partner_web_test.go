package bootstrap

import "testing"

// Через одно поле регистрации приходят оба параметра «откуда пришёл»:
// партнёрский код и реферальный telegram_id. Разбор обязан их различать, иначе
// клиент попадёт не в ту программу.
func TestParsePartnerCode(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{"код из ссылки", "a7f3k2", "a7f3k2"},
		{"код с префиксом из deeplink", "p_a7f3k2", "a7f3k2"},
		{"регистр не важен", "P_A7F3K2", "a7f3k2"},
		{"пробелы обрезаются", "  a7f3k2  ", "a7f3k2"},
		{"реферальный telegram_id — не код", "123456789", ""},
		{"реферальный параметр с префиксом — не код", "ref_123456789", ""},
		{"пусто", "", ""},
		{"только префикс", "p_", ""},
		{"посторонние символы отбрасываются", "a7f3k2; DROP TABLE partner", ""},
		{"слишком длинный", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ParsePartnerCode(tc.raw); got != tc.want {
				t.Fatalf("ParsePartnerCode(%q) = %q, want %q", tc.raw, got, tc.want)
			}
		})
	}
}

// Реферальный разбор не должен перехватывать партнёрские коды.
func TestParseReferralTelegramID_IgnoresPartnerCode(t *testing.T) {
	if got := ParseReferralTelegramID("p_a7f3k2"); got != 0 {
		t.Fatalf("ParseReferralTelegramID(\"p_a7f3k2\") = %d, want 0", got)
	}
	if got := ParseReferralTelegramID("ref_123456789"); got != 123456789 {
		t.Fatalf("ParseReferralTelegramID(\"ref_123456789\") = %d, want 123456789", got)
	}
}
