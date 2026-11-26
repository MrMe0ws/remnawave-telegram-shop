package loyalty

import "remnawave-tg-shop-bot/internal/database"

// BuildCustomerXPSumsFromPaidPurchases суммирует XP по клиентам для всех успешных оплат (та же формула, что при живом начислении).
func BuildCustomerXPSumsFromPaidPurchases(purchases []database.Purchase) map[int64]int64 {
	out := make(map[int64]int64)
	for i := range purchases {
		p := &purchases[i]
		add := XPRubEquivalentForPurchase(p)
		if add <= 0 {
			continue
		}
		out[p.CustomerID] += add
	}
	return out
}

// BuildCustomerXPSums — итоговые суммы для полного пересчёта: XP за оплаты плюс
// XP, выигранные в колесе фортуны (fortuneXP: customer_id → сумма наград xp/micro).
// Колесо — единственный источник XP помимо оплат; без него пересчёт стирал бы призы.
func BuildCustomerXPSums(purchases []database.Purchase, fortuneXP map[int64]int64) map[int64]int64 {
	out := BuildCustomerXPSumsFromPaidPurchases(purchases)
	for cid, xp := range fortuneXP {
		if xp <= 0 {
			continue
		}
		out[cid] += xp
	}
	return out
}
