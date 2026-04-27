package metrics

import "testing"

func TestNormalizeAPIPath(t *testing.T) {
	cases := []struct{ in, want string }{
		{"/cabinet/api/payments/42/status", "/cabinet/api/payments/:id/status"},
		{"/cabinet/api/me", "/cabinet/api/me"},
		{"/cabinet/assets/foo.js", "/cabinet/*"},
		{"/healthcheck", "other"},
	}
	for _, c := range cases {
		if got := NormalizeAPIPath(c.in); got != c.want {
			t.Errorf("NormalizeAPIPath(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
