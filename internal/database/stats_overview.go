package database

import (
	"context"
	"fmt"
	"time"
)

// AdminOverviewCounters — то немногое из нашей базы, что нужно «Обзору».
//
// Отдельно от FetchAdminStatsSnapshot намеренно: снимок статистики считает
// три десятка агрегатов за пять периодов, а дашборд открывают часто и ради
// сегодняшних чисел. Тянуть ради них весь снимок — это секунды ожидания на
// каждый заход.
type AdminOverviewCounters struct {
	TotalCustomers      int64
	ActiveSubscriptions int64

	RevenueTodayRub float64
	RevenueMonthRub float64
	SalesToday      int64
	PayersToday     int64

	// Счета, застрявшие вне терминального статуса: их видно на «Платежах»,
	// и обычно это или брошенная оплата, или зависший вебхук.
	OpenInvoices int64
}

// FetchAdminOverviewCounters собирает счётчики дашборда одним запросом.
func (s *StatsRepository) FetchAdminOverviewCounters(ctx context.Context) (*AdminOverviewCounters, error) {
	now := time.Now().UTC()
	today0 := utcDayStart(now)
	monthStart, monthEnd := monthRangeUTC(now)

	out := &AdminOverviewCounters{}
	q := fmt.Sprintf(`
SELECT
  (SELECT COUNT(*) FROM customer),
  (SELECT COUNT(*) FROM customer WHERE expire_at IS NOT NULL AND expire_at > NOW()),
  (SELECT COALESCE(SUM(p.amount), 0)::float8 FROM purchase p
     WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2 AND %s),
  (SELECT COALESCE(SUM(p.amount), 0)::float8 FROM purchase p
     WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $3 AND p.paid_at < $4 AND %s),
  (SELECT COUNT(*) FROM purchase p WHERE %s AND p.paid_at >= $1 AND p.paid_at < $2),
  (SELECT COUNT(DISTINCT p.customer_id) FROM purchase p
     WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2),
  (SELECT COUNT(*) FROM purchase p WHERE p.status IN ('new', 'pending'))`,
		sqlRubCurrency, sqlRubCurrency, sqlSubPurchase)

	if err := s.pool.QueryRow(ctx, q, today0, now, monthStart, monthEnd).Scan(
		&out.TotalCustomers, &out.ActiveSubscriptions,
		&out.RevenueTodayRub, &out.RevenueMonthRub,
		&out.SalesToday, &out.PayersToday, &out.OpenInvoices,
	); err != nil {
		return nil, fmt.Errorf("stats overview counters: %w", err)
	}
	return out, nil
}
