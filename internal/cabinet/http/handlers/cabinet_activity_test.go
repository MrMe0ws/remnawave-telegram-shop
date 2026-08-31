package handlers

import "testing"

// Наружу не должно уходить ни одного полного идентификатора: ни ника, ни почты.
func TestMaskReferee(t *testing.T) {
	cases := []struct {
		name     string
		username *string
		email    *string
		tg       int64
		want     string
	}{
		{"username", strPtr("ivan_k"), strPtr("ivan@mail.ru"), 123456789, "@i***k"},
		{"display name with space", strPtr("Иван Петров"), nil, 123456789, "И***в"},
		{"email when no username", nil, strPtr("ivan@mail.ru"), 123456789, "i***n@mail.ru"},
		{"blank username falls through", strPtr("   "), strPtr("ivan@mail.ru"), 123456789, "i***n@mail.ru"},
		{"telegram id as last resort", nil, nil, 123456789, "1234*****"},
		{"blank email falls through", nil, strPtr(" "), 123456789, "1234*****"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := maskReferee(c.username, c.email, c.tg); got != c.want {
				t.Errorf("maskReferee() = %q, want %q", got, c.want)
			}
		})
	}
}
