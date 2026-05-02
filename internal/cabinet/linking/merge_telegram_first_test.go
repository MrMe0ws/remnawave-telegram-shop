package linking

import "testing"

func TestMergePreservesTelegramCustomerRow(t *testing.T) {
	cases := []struct {
		name        string
		keep        string
		hasTelegram bool
		want        bool
	}{
		{
			name:        "keep_tg_without_identity_still_preserves_tg_row",
			keep:        "tg",
			hasTelegram: false,
			want:        true,
		},
		{
			name:        "keep_web_without_identity_deletes_tg_customer_path",
			keep:        "web",
			hasTelegram: false,
			want:        false,
		},
		{
			name:        "keep_web_with_telegram_identity_preserves_tg_row",
			keep:        "web",
			hasTelegram: true,
			want:        true,
		},
		{
			name:        "keep_tg_with_telegram_identity",
			keep:        "tg",
			hasTelegram: true,
			want:        true,
		},
		{
			name:        "trim_and_case_insensitive_web_with_identity",
			keep:        " WEB ",
			hasTelegram: true,
			want:        true,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := mergePreservesTelegramCustomerRow(tc.keep, tc.hasTelegram); got != tc.want {
				t.Fatalf("mergePreservesTelegramCustomerRow(%q, %v) = %v, want %v",
					tc.keep, tc.hasTelegram, got, tc.want)
			}
		})
	}
}
