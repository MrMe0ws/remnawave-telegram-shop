package broadcast

import (
	"reflect"
	"testing"
)

func TestNormalizeCabinetLinkKeys(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{name: "empty", in: nil, want: nil},
		{name: "unknown keys dropped", in: []string{"nope", "partner"}, want: []string{"partner"}},
		{name: "duplicates collapsed", in: []string{"partner", "partner"}, want: []string{"partner"}},
		{name: "trims spaces", in: []string{" loyalty "}, want: []string{"loyalty"}},
		{
			name: "registry order, not input order",
			in:   []string{"loyalty", "tariffs", "referral"},
			want: []string{"tariffs", "referral", "loyalty"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeCabinetLinkKeys(tt.in)
			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("NormalizeCabinetLinkKeys(%v) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

func TestIsCabinetLinkKey(t *testing.T) {
	for _, link := range CabinetLinks() {
		if !IsCabinetLinkKey(link.Key) {
			t.Errorf("IsCabinetLinkKey(%q) = false, want true", link.Key)
		}
	}
	if IsCabinetLinkKey("settings") {
		t.Error(`IsCabinetLinkKey("settings") = true, want false`)
	}
}

// Подпись и URL кнопки резолвятся в момент отправки, поэтому пустой реестр или
// незаполненные поля тихо съели бы кнопку.
func TestCabinetLinksAreComplete(t *testing.T) {
	seen := make(map[string]bool)
	for _, link := range CabinetLinks() {
		if link.Key == "" || link.TranslationKey == "" || link.resolveURL == nil {
			t.Errorf("incomplete cabinet link: %+v", link)
		}
		if seen[link.Key] {
			t.Errorf("duplicate cabinet link key %q", link.Key)
		}
		seen[link.Key] = true
	}
}

func TestRecipientButtonsIsEmpty(t *testing.T) {
	if !(RecipientButtons{}).IsEmpty() {
		t.Error("zero RecipientButtons should be empty")
	}
	if (RecipientButtons{Links: []string{"partner"}}).IsEmpty() {
		t.Error("RecipientButtons with links should not be empty")
	}
}
