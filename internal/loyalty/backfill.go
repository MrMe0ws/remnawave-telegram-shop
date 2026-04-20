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
