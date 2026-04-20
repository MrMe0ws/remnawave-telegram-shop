package loyalty

import (
	"math"

	"remnawave-tg-shop-bot/internal/database"
)

// XPConfig задаёт правила расчёта XP (обычно из переменных окружения).
type XPConfig struct {
	RubPerStar float64       // ₽ за 1 Star; 0 — без конвертации Stars→₽
	MonthXP    map[int]int64 // резервный XP по полю purchase.month (например 1→50, 3→150)
	MinPerPaid int64         // минимум XP за успешную оплату, если сумма и month не дали XP
	BonusXPPerExtraHwidSlot int64 // добавка за каждый доп. слот HWID в строке покупки (0 = выкл.)
}

func monthFallbackXP(month int, table map[int]int64) int64 {
	if month <= 0 || len(table) == 0 {
		return 0
	}
	return table[month]
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

// TotalXPForPurchase полная формула XP по строке purchase (см. docs/loyalty/business-logic.md): сумма → month → минимум; затем бонус за Extra HWID.
func TotalXPForPurchase(p *database.Purchase, c XPConfig) int64 {
	if p == nil {
		return 0
	}
	primary := primaryXPFromAmount(p, c.RubPerStar)
	if primary <= 0 {
		primary = monthFallbackXP(p.Month, c.MonthXP)
	}
	if primary <= 0 {
		primary = c.MinPerPaid
	}
	bonus := int64(p.ExtraHwid) * c.BonusXPPerExtraHwidSlot
	return primary + bonus
}
