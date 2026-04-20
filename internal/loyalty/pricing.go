package loyalty

import (
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/promo"
)

// CombinedDiscountPercent clamps loyalty+promo additive sum by cap (1..100).
func CombinedDiscountPercent(loyaltyPct, promoPct, cap int) int {
	sum := loyaltyPct + promoPct
	if sum < 0 {
		return 0
	}
	if cap < 1 {
		cap = 100
	}
	if cap > 100 {
		cap = 100
	}
	if sum > cap {
		return cap
	}
	return sum
}

// ApplyCombinedPercentDiscount применяет один итоговый процент к базе (как promo.ApplyPercentDiscountInt).
func ApplyCombinedPercentDiscount(base int, loyaltyPct, promoPct, cap int) int {
	total := CombinedDiscountPercent(loyaltyPct, promoPct, cap)
	return promo.ApplyPercentDiscountInt(base, total)
}

// XPRubEquivalentForPurchase начисление XP по строке purchase: ₽/Stars → XP, резерв по month и минимум (см. docs/loyalty/business-logic.md). Стоимость доп. HWID уже в purchase.amount.
func XPRubEquivalentForPurchase(p *database.Purchase) int64 {
	cfg := XPConfig{
		RubPerStar: config.RubPerStar(),
		MonthXP:    config.LoyaltyMonthXPFallbackMap(),
		MinPerPaid: config.LoyaltyXPMinPerPaidPurchase(),
	}
	return TotalXPForPurchase(p, cfg)
}
