package loyalty

import "testing"

func TestCombinedDiscountPercent(t *testing.T) {
	if got := CombinedDiscountPercent(10, 20, 100); got != 30 {
		t.Fatalf("got %d want 30", got)
	}
	if got := CombinedDiscountPercent(40, 40, 50); got != 50 {
		t.Fatalf("cap: got %d want 50", got)
	}
	if got := CombinedDiscountPercent(-5, 10, 100); got != 5 {
		t.Fatalf("negative loyalty: got %d want 5", got)
	}
}
