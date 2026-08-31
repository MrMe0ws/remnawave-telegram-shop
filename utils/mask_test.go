package utils

import "testing"

func TestMaskEdges(t *testing.T) {
	cases := map[string]string{
		"":          "",
		"a":         "a***",
		"ab":        "a***b",
		"ivan_k":    "i***k",
		"Александр": "А***р",
	}
	for in, want := range cases {
		if got := MaskEdges(in); got != want {
			t.Errorf("MaskEdges(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMaskEmail(t *testing.T) {
	cases := map[string]string{
		"ivan@mail.ru": "i***n@mail.ru",
		"a@mail.ru":    "a***@mail.ru",
		"IVAN@Mail.RU": "i***n@mail.ru",
		"not-an-email": "n***l",
		"@mail.ru":     "@***u",
		"ivan@":        "i***@",
	}
	for in, want := range cases {
		if got := MaskEmail(in); got != want {
			t.Errorf("MaskEmail(%q) = %q, want %q", in, got, want)
		}
	}
}

// Клиент какое-то время продолжит маскировать пришедшую строку сам, и повторный
// прогон не должен превращать «i***n@mail.ru» во что-то ещё более короткое.
func TestMaskIsIdempotent(t *testing.T) {
	for _, in := range []string{"ivan_k", "ivan@mail.ru", "ab", "a"} {
		once := MaskEdges(in)
		if twice := MaskEdges(once); twice != once {
			t.Errorf("MaskEdges not idempotent for %q: %q -> %q", in, once, twice)
		}
		onceMail := MaskEmail(in)
		if twiceMail := MaskEmail(onceMail); twiceMail != onceMail {
			t.Errorf("MaskEmail not idempotent for %q: %q -> %q", in, onceMail, twiceMail)
		}
	}
}
