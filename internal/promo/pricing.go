package promo

// ApplyPercentDiscountInt returns base price reduced by percent (1–100). Minimum result is 1.
func ApplyPercentDiscountInt(base int, percent int) int {
	if percent <= 0 || percent > 100 {
		return base
	}
	out := base * (100 - percent) / 100
	if out < 1 {
		return 1
	}
	return out
}
