package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"

	"remnawave-tg-shop-bot/internal/config"
)

// StatsRepository агрегаты для админ-экрана «Статистика».
type StatsRepository struct {
	pool *pgxpool.Pool
}

func NewStatsRepository(pool *pgxpool.Pool) *StatsRepository {
	return &StatsRepository{pool: pool}
}

const sqlSubPurchase = `p.status = 'paid' AND p.month > 0 AND p.purchase_kind IN ('subscription', 'tariff_upgrade')`

const sqlRubCurrency = `(UPPER(TRIM(COALESCE(p.currency, ''))) IN ('RUB', 'RUR', '') OR COALESCE(p.currency, '') = '')`

// AdminTopReferrer строка топа рефереров (дни начислений рефереру добиваются в handler через ReferralRepository).
type AdminTopReferrer struct {
	ReferrerID   int64
	PaidReferees int64
}

// AdminTariffStat метрики по одному тарифу (SALES_MODE=tariffs).
type AdminTariffStat struct {
	TariffID          int64
	DisplayName       string
	SalesToday        int64
	SalesWeek         int64
	SalesMonth        int64
	SubsRevenueMonth  float64
	RevenueToday      float64
	RevenueAll        float64
	ActivePaidUsers   int64
}

// AdminStatsSnapshot снимок метрик на момент запроса.
type AdminStatsSnapshot struct {
	CapturedAt time.Time

	TotalCustomers      int64
	ActiveSubscriptions int64
	NewToday            int64
	NewWeek             int64
	NewMonth            int64
	NewPrevMonth        int64

	TrialActive int64
	PaidActive  int64
	Inactive    int64

	SalesSubToday     int64
	SalesSubWeek      int64
	SalesSubMonth     int64
	SalesSubPrevMonth int64

	RevenueMonthRub       float64
	RevenueTodayRub       float64
	RevenueAllTimeRub     float64
	RevenueSubsMonthRub   float64
	TransactionsToday     int64
	TransactionsMonth     int64
	UniquePayersMonth     int64
	PaymentRubByInvoice   map[string]float64

	DistinctReferrers int64
	ActiveReferrers   int64
	RefBonusDaysAll   int64
	RefBonusDaysToday int64
	RefBonusDaysWeek  int64
	RefBonusDaysMonth int64
	TopReferrers      []AdminTopReferrer

	TariffBreakdown []AdminTariffStat
}

func utcDayStart(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func monthRangeUTC(t time.Time) (start, end time.Time) {
	t = t.UTC()
	start = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
	end = start.AddDate(0, 1, 0)
	return start, end
}

func prevMonthRangeUTC(t time.Time) (start, end time.Time) {
	t = t.UTC()
	firstThis := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
	end = firstThis
	start = firstThis.AddDate(0, -1, 0)
	return start, end
}

// FetchAdminStatsSnapshot собирает метрики для админ-статистики.
func (s *StatsRepository) FetchAdminStatsSnapshot(ctx context.Context) (*AdminStatsSnapshot, error) {
	now := time.Now().UTC()
	today0 := utcDayStart(now)
	weekAgo := today0.AddDate(0, 0, -7)
	monthStart, monthEnd := monthRangeUTC(now)
	prevStart, prevEnd := prevMonthRangeUTC(now)

	out := &AdminStatsSnapshot{
		CapturedAt:        now,
		PaymentRubByInvoice: make(map[string]float64),
	}

	q := `SELECT COUNT(*) FROM customer`
	if err := s.pool.QueryRow(ctx, q).Scan(&out.TotalCustomers); err != nil {
		return nil, fmt.Errorf("stats total customers: %w", err)
	}

	q = `SELECT COUNT(*) FROM customer WHERE expire_at IS NOT NULL AND expire_at > NOW()`
	if err := s.pool.QueryRow(ctx, q).Scan(&out.ActiveSubscriptions); err != nil {
		return nil, fmt.Errorf("stats active subscriptions: %w", err)
	}

	q = `SELECT COUNT(*) FROM customer WHERE created_at >= $1`
	if err := s.pool.QueryRow(ctx, q, today0).Scan(&out.NewToday); err != nil {
		return nil, fmt.Errorf("stats new today: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, weekAgo).Scan(&out.NewWeek); err != nil {
		return nil, fmt.Errorf("stats new week: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, monthStart).Scan(&out.NewMonth); err != nil {
		return nil, fmt.Errorf("stats new month: %w", err)
	}

	q = `SELECT COUNT(*) FROM customer WHERE created_at >= $1 AND created_at < $2`
	if err := s.pool.QueryRow(ctx, q, prevStart, prevEnd).Scan(&out.NewPrevMonth); err != nil {
		return nil, fmt.Errorf("stats new in prev calendar month: %w", err)
	}

	q = `
SELECT
  COUNT(*) FILTER (WHERE c.expire_at IS NOT NULL AND c.expire_at > NOW() AND NOT EXISTS (
    SELECT 1 FROM purchase p WHERE p.customer_id = c.id AND p.status = 'paid' AND p.month > 0
  )) AS trial,
  COUNT(*) FILTER (WHERE c.expire_at IS NOT NULL AND c.expire_at > NOW() AND EXISTS (
    SELECT 1 FROM purchase p WHERE p.customer_id = c.id AND p.status = 'paid' AND p.month > 0
  )) AS paid,
  COUNT(*) FILTER (WHERE NOT (c.expire_at IS NOT NULL AND c.expire_at > NOW())) AS inactive
FROM customer c`
	if err := s.pool.QueryRow(ctx, q).Scan(&out.TrialActive, &out.PaidActive, &out.Inactive); err != nil {
		return nil, fmt.Errorf("stats subscription buckets: %w", err)
	}

	q = fmt.Sprintf(`SELECT COUNT(*) FROM purchase p WHERE %s AND p.paid_at >= $1 AND p.paid_at < $2`, sqlSubPurchase)
	if err := s.pool.QueryRow(ctx, q, today0, now).Scan(&out.SalesSubToday); err != nil {
		return nil, fmt.Errorf("stats sales today: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, weekAgo, now).Scan(&out.SalesSubWeek); err != nil {
		return nil, fmt.Errorf("stats sales week: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, monthStart, monthEnd).Scan(&out.SalesSubMonth); err != nil {
		return nil, fmt.Errorf("stats sales month: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, prevStart, prevEnd).Scan(&out.SalesSubPrevMonth); err != nil {
		return nil, fmt.Errorf("stats sales prev month: %w", err)
	}

	q = fmt.Sprintf(`
SELECT COALESCE(SUM(p.amount), 0)::float8 FROM purchase p
WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2 AND %s`, sqlRubCurrency)
	if err := s.pool.QueryRow(ctx, q, monthStart, monthEnd).Scan(&out.RevenueMonthRub); err != nil {
		return nil, fmt.Errorf("stats revenue month: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, today0, now).Scan(&out.RevenueTodayRub); err != nil {
		return nil, fmt.Errorf("stats revenue today: %w", err)
	}
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(SUM(p.amount), 0)::float8 FROM purchase p WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND `+sqlRubCurrency).Scan(&out.RevenueAllTimeRub); err != nil {
		return nil, fmt.Errorf("stats revenue all time: %w", err)
	}

	q = fmt.Sprintf(`
SELECT COALESCE(SUM(p.amount), 0)::float8 FROM purchase p
WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2 AND %s AND %s`, sqlSubPurchase, sqlRubCurrency)
	if err := s.pool.QueryRow(ctx, q, monthStart, monthEnd).Scan(&out.RevenueSubsMonthRub); err != nil {
		return nil, fmt.Errorf("stats revenue subs month: %w", err)
	}

	q = `SELECT COUNT(*) FROM purchase p WHERE p.status = 'paid' AND p.paid_at >= $1 AND p.paid_at < $2`
	if err := s.pool.QueryRow(ctx, q, today0, now).Scan(&out.TransactionsToday); err != nil {
		return nil, fmt.Errorf("stats tx today: %w", err)
	}
	if err := s.pool.QueryRow(ctx, q, monthStart, monthEnd).Scan(&out.TransactionsMonth); err != nil {
		return nil, fmt.Errorf("stats tx month: %w", err)
	}

	q = fmt.Sprintf(`
SELECT COUNT(DISTINCT p.customer_id) FROM purchase p
WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2 AND %s`, sqlRubCurrency)
	if err := s.pool.QueryRow(ctx, q, monthStart, monthEnd).Scan(&out.UniquePayersMonth); err != nil {
		return nil, fmt.Errorf("stats unique payers month: %w", err)
	}

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
SELECT p.invoice_type::text, COALESCE(SUM(p.amount), 0)::float8
FROM purchase p
WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND %s
GROUP BY p.invoice_type`, sqlRubCurrency))
	if err != nil {
		return nil, fmt.Errorf("stats payment breakdown: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var inv string
		var sum float64
		if err := rows.Scan(&inv, &sum); err != nil {
			return nil, err
		}
		out.PaymentRubByInvoice[inv] = sum
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := s.pool.QueryRow(ctx, `SELECT COUNT(DISTINCT referrer_id) FROM referral`).Scan(&out.DistinctReferrers); err != nil {
		return nil, fmt.Errorf("stats distinct referrers: %w", err)
	}

	q = `
SELECT COUNT(DISTINCT r.referrer_id) FROM referral r
JOIN customer c ON c.telegram_id = r.referee_id
WHERE EXISTS (
  SELECT 1 FROM purchase p WHERE p.customer_id = c.id AND p.status = 'paid' AND p.month > 0
)`
	if err := s.pool.QueryRow(ctx, q).Scan(&out.ActiveReferrers); err != nil {
		return nil, fmt.Errorf("stats active referrers: %w", err)
	}

	refToday, refWeek, refMonth, refAll, err := s.referralBonusDaysReferrer(ctx, today0, weekAgo, monthStart, monthEnd, now)
	if err != nil {
		return nil, err
	}
	out.RefBonusDaysToday = refToday
	out.RefBonusDaysWeek = refWeek
	out.RefBonusDaysMonth = refMonth
	out.RefBonusDaysAll = refAll

	top, err := s.topReferrers(ctx, 10)
	if err != nil {
		return nil, err
	}
	out.TopReferrers = top

	if config.SalesMode() == "tariffs" {
		tb, err := s.loadTariffBreakdown(ctx, now, today0, weekAgo, monthStart, monthEnd)
		if err != nil {
			return nil, err
		}
		out.TariffBreakdown = tb
	}

	return out, nil
}

func (s *StatsRepository) loadTariffBreakdown(ctx context.Context, now, today0, weekAgo, monthStart, monthEnd time.Time) ([]AdminTariffStat, error) {
	qTariffs := `
SELECT id, COALESCE(NULLIF(TRIM(name), ''), slug) AS disp, sort_order
FROM tariff
ORDER BY sort_order ASC, id ASC`
	rows, err := s.pool.Query(ctx, qTariffs)
	if err != nil {
		return nil, fmt.Errorf("stats list tariffs: %w", err)
	}
	type tarRow struct {
		id    int64
		name  string
		order int
	}
	var order []tarRow
	for rows.Next() {
		var r tarRow
		if err := rows.Scan(&r.id, &r.name, &r.order); err != nil {
			rows.Close()
			return nil, err
		}
		order = append(order, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(order) == 0 {
		return nil, nil
	}

	salesWhere := fmt.Sprintf(`(%s) AND p.tariff_id IS NOT NULL`, sqlSubPurchase)
	revCond := fmt.Sprintf(`p.status = 'paid' AND p.paid_at IS NOT NULL AND %s AND p.tariff_id IS NOT NULL`, sqlRubCurrency)

	salesQ := fmt.Sprintf(`
SELECT p.tariff_id,
  COUNT(*) FILTER (WHERE p.paid_at >= $1 AND p.paid_at < $2) AS d,
  COUNT(*) FILTER (WHERE p.paid_at >= $3 AND p.paid_at < $2) AS w,
  COUNT(*) FILTER (WHERE p.paid_at >= $4 AND p.paid_at < $5) AS m
FROM purchase p
WHERE %s
GROUP BY p.tariff_id`, salesWhere)

	type saleAgg struct{ d, w, m int64 }
	salesMap := make(map[int64]saleAgg)
	srows, err := s.pool.Query(ctx, salesQ, today0, now, weekAgo, monthStart, monthEnd)
	if err != nil {
		return nil, fmt.Errorf("stats tariff sales: %w", err)
	}
	for srows.Next() {
		var tid int64
		var a saleAgg
		if err := srows.Scan(&tid, &a.d, &a.w, &a.m); err != nil {
			srows.Close()
			return nil, err
		}
		salesMap[tid] = a
	}
	srows.Close()
	if err := srows.Err(); err != nil {
		return nil, err
	}

	revTodayQ := fmt.Sprintf(`
SELECT p.tariff_id, COALESCE(SUM(p.amount), 0)::float8
FROM purchase p
WHERE p.paid_at >= $1 AND p.paid_at < $2 AND %s
GROUP BY p.tariff_id`, revCond)
	revToday := map[int64]float64{}
	rtRows, err := s.pool.Query(ctx, revTodayQ, today0, now)
	if err != nil {
		return nil, fmt.Errorf("stats tariff rev today: %w", err)
	}
	for rtRows.Next() {
		var tid int64
		var sum float64
		if err := rtRows.Scan(&tid, &sum); err != nil {
			rtRows.Close()
			return nil, err
		}
		revToday[tid] = sum
	}
	rtRows.Close()
	if err := rtRows.Err(); err != nil {
		return nil, err
	}

	revAllQ := fmt.Sprintf(`
SELECT p.tariff_id, COALESCE(SUM(p.amount), 0)::float8
FROM purchase p
WHERE %s
GROUP BY p.tariff_id`, revCond)
	revAll := map[int64]float64{}
	raRows, err := s.pool.Query(ctx, revAllQ)
	if err != nil {
		return nil, fmt.Errorf("stats tariff rev all: %w", err)
	}
	for raRows.Next() {
		var tid int64
		var sum float64
		if err := raRows.Scan(&tid, &sum); err != nil {
			raRows.Close()
			return nil, err
		}
		revAll[tid] = sum
	}
	raRows.Close()
	if err := raRows.Err(); err != nil {
		return nil, err
	}

	subsMonthQ := fmt.Sprintf(`
SELECT p.tariff_id, COALESCE(SUM(p.amount), 0)::float8
FROM purchase p
WHERE p.paid_at >= $1 AND p.paid_at < $2
  AND (%s)
  AND (%s)
  AND p.tariff_id IS NOT NULL
GROUP BY p.tariff_id`, sqlSubPurchase, sqlRubCurrency)
	subsMonth := map[int64]float64{}
	smRows, err := s.pool.Query(ctx, subsMonthQ, monthStart, monthEnd)
	if err != nil {
		return nil, fmt.Errorf("stats tariff subs month rev: %w", err)
	}
	for smRows.Next() {
		var tid int64
		var sum float64
		if err := smRows.Scan(&tid, &sum); err != nil {
			smRows.Close()
			return nil, err
		}
		subsMonth[tid] = sum
	}
	smRows.Close()
	if err := smRows.Err(); err != nil {
		return nil, err
	}

	activeQ := `
SELECT c.current_tariff_id, COUNT(*)::bigint
FROM customer c
WHERE c.expire_at IS NOT NULL AND c.expire_at > NOW()
  AND c.current_tariff_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM purchase p
    WHERE p.customer_id = c.id AND p.status = 'paid' AND p.month > 0
  )
GROUP BY c.current_tariff_id`
	activeMap := map[int64]int64{}
	arows, err := s.pool.Query(ctx, activeQ)
	if err != nil {
		return nil, fmt.Errorf("stats tariff active paid: %w", err)
	}
	for arows.Next() {
		var tid, n int64
		if err := arows.Scan(&tid, &n); err != nil {
			arows.Close()
			return nil, err
		}
		activeMap[tid] = n
	}
	arows.Close()
	if err := arows.Err(); err != nil {
		return nil, err
	}

	out := make([]AdminTariffStat, 0, len(order))
	for _, tr := range order {
		sa := salesMap[tr.id]
		out = append(out, AdminTariffStat{
			TariffID:         tr.id,
			DisplayName:      tr.name,
			SalesToday:       sa.d,
			SalesWeek:        sa.w,
			SalesMonth:       sa.m,
			SubsRevenueMonth: subsMonth[tr.id],
			RevenueToday:     revToday[tr.id],
			RevenueAll:       revAll[tr.id],
			ActivePaidUsers:  activeMap[tr.id],
		})
	}
	return out, nil
}

func (s *StatsRepository) referralBonusDaysReferrer(ctx context.Context, today0, weekAgo, monthStart, monthEnd, now time.Time) (today, week, month, all int64, err error) {
	if config.ReferralMode() == "progressive" {
		all, err = s.sumProgressiveReferrerDays(ctx, time.Time{}, now)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		today, err = s.sumProgressiveReferrerDays(ctx, today0, now)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		week, err = s.sumProgressiveReferrerDays(ctx, weekAgo, now)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		month, err = s.sumProgressiveReferrerDays(ctx, monthStart, monthEnd)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		return today, week, month, all, nil
	}

	days := int64(config.GetReferralDays())
	if days <= 0 {
		return 0, 0, 0, 0, nil
	}

	countRange := func(from, to time.Time) (int64, error) {
		var n int64
		q := `
WITH fp AS (
  SELECT c.telegram_id AS tid, MIN(p.paid_at) AS first_paid
  FROM purchase p
  JOIN customer c ON c.id = p.customer_id
  WHERE p.status = 'paid' AND p.month > 0
  GROUP BY c.telegram_id
)
SELECT COUNT(*) FROM referral r
JOIN fp ON fp.tid = r.referee_id
WHERE fp.first_paid >= $1 AND fp.first_paid < $2`
		err := s.pool.QueryRow(ctx, q, from, to).Scan(&n)
		return n * days, err
	}

	var allN int64
	q := `
WITH fp AS (
  SELECT c.telegram_id AS tid, MIN(p.paid_at) AS first_paid
  FROM purchase p
  JOIN customer c ON c.id = p.customer_id
  WHERE p.status = 'paid' AND p.month > 0
  GROUP BY c.telegram_id
)
SELECT COUNT(*) FROM referral r
JOIN fp ON fp.tid = r.referee_id`
	if err := s.pool.QueryRow(ctx, q).Scan(&allN); err != nil {
		return 0, 0, 0, 0, err
	}
	all = allN * days

	today, err = countRange(today0, now)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	week, err = countRange(weekAgo, now)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	month, err = countRange(monthStart, monthEnd)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	return today, week, month, all, nil
}

func (s *StatsRepository) sumProgressiveReferrerDays(ctx context.Context, from, to time.Time) (int64, error) {
	first := config.ReferralFirstReferrerDays()
	repeat := config.ReferralRepeatReferrerDays()
	var filter string
	args := []interface{}{first, repeat}
	if from.IsZero() {
		filter = `WHERE p.paid_at IS NOT NULL AND p.paid_at < $3`
		args = append(args, to)
	} else {
		filter = `WHERE p.paid_at IS NOT NULL AND p.paid_at >= $3 AND p.paid_at < $4`
		args = append(args, from, to)
	}
	q := `
WITH ranked AS (
  SELECT p.paid_at,
         ROW_NUMBER() OVER (PARTITION BY p.customer_id ORDER BY p.paid_at) AS rn
  FROM purchase p
  JOIN customer c ON c.id = p.customer_id
  JOIN referral ref ON ref.referee_id = c.telegram_id
  WHERE p.status = 'paid' AND p.month > 0
)
SELECT COALESCE(SUM(
  CASE WHEN p.rn = 1 THEN $1::int ELSE $2::int END
), 0)::bigint
FROM ranked p
` + filter
	var sum int64
	err := s.pool.QueryRow(ctx, q, args...).Scan(&sum)
	if err != nil {
		return 0, fmt.Errorf("stats progressive ref days: %w", err)
	}
	return sum, nil
}

func (s *StatsRepository) topReferrers(ctx context.Context, limit int) ([]AdminTopReferrer, error) {
	q := `
SELECT r.referrer_id, COUNT(DISTINCT r.referee_id) AS n
FROM referral r
JOIN customer c ON c.telegram_id = r.referee_id
WHERE EXISTS (
  SELECT 1 FROM purchase p WHERE p.customer_id = c.id AND p.status = 'paid' AND p.month > 0
)
GROUP BY r.referrer_id
ORDER BY n DESC
LIMIT $1`
	rows, err := s.pool.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("stats top referrers: %w", err)
	}
	defer rows.Close()
	var list []AdminTopReferrer
	for rows.Next() {
		var tr AdminTopReferrer
		if err := rows.Scan(&tr.ReferrerID, &tr.PaidReferees); err != nil {
			return nil, err
		}
		list = append(list, tr)
	}
	return list, rows.Err()
}
