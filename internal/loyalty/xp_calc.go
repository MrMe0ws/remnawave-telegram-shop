package loyalty

import (
	"math"

	"remnawave-tg-shop-bot/internal/database"
)

// XPConfig задаёт правила расчёта XP (обычно из переменных окружения).
type XPConfig struct {
	RubPerStar float64 // ₽ за 1 Star; 0 — без конвертации Stars→₽ (для Stars задайте RUB_PER_STAR)
	MinPerPaid int64   // минимум XP за успешную оплату, если сумма не дала XP
}

func primaryXPFromAmount(p *database.Purchase, rubPerStar float64) int64 {
	if p == nil {
		return 0
	}
	if p.InvoiceType == database.InvoiceTypeTelegram {
		if rubPerStar <= 0 {
			return 0
		}
		return int64(math.Round(p.Amount * rubPerStar))
	}
	return int64(math.Round(p.Amount))
}

// TotalXPForPurchase полная формула XP по строке purchase: сумма в ₽ или Stars×RUB_PER_STAR (доп. HWID уже в amount) → при нуле минимум LOYALTY_XP_MIN_PER_PURCHASE.
func TotalXPForPurchase(p *database.Purchase, c XPConfig) int64 {
	if p == nil {
		return 0
	}
	primary := primaryXPFromAmount(p, c.RubPerStar)
	if primary <= 0 {
		primary = c.MinPerPaid
	}
	return primary
}
