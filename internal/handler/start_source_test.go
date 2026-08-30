package handler

import "testing"

// Разбор аргумента /start. Прежняя реализация делала strings.Split(text, " ")[1]
// после проверки на вхождение "ref_" — на тексте без пробела это паника.
func TestParseStartArg(t *testing.T) {
	cases := []struct {
		name string
		text string
		want string
	}{
		{"партнёрская ссылка", "/start p_a7f3k2", "p_a7f3k2"},
		{"реферальная ссылка", "/start ref_123456789", "ref_123456789"},
		{"без аргумента", "/start", ""},
		{"пустой текст", "", ""},
		{"текст без пробела, но с префиксом", "/startref_123", ""},
		{"лишние пробелы", "/start   p_a7f3k2  ", "p_a7f3k2"},
		{"хвост после аргумента игнорируется", "/start p_a7f3k2 мусор", "p_a7f3k2"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := parseStartArg(tc.text); got != tc.want {
				t.Fatalf("parseStartArg(%q) = %q, want %q", tc.text, got, tc.want)
			}
		})
	}
}
