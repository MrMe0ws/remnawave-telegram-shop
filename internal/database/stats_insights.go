package database

import (
	"context"
	"fmt"
	"time"
)

// Метрики второго эшелона для админ-статистики: воронка, когда покупают, срок
// жизни подписки, продления против первых покупок и предыдущий период для
// процентов роста.
//
// Живут отдельно от FetchAdminStatsSnapshot намеренно. Снимок отвечает на
// вопрос «сколько сейчас» и не зависит от выбранного периода; здесь всё
// считается за произвольное окно [from, to) — то же самое, по которому строится
// график. Иначе цифры карточек и график разъезжались бы на кастомном диапазоне.

// AdminStatsFunnel — воронка за период.
//
// Шага «зашёл на сайт» нет: визиты нигде не пишутся. Воронка когортная —
// берутся клиенты, зарегистрированные в периоде, и смотрится, сколько из них
// дошли до счёта и до оплаты. Так она заведомо не расширяется книзу: считать
// независимо зарегистрировавшихся, выставивших счёт и заплативших нельзя —
// заплатить в этом месяце мог тот, кто выставил счёт в прошлом.
type AdminStatsFunnel struct {
	Registered int64
	Invoiced   int64
	Paid       int64

	// Отдельно — конверсия самих счетов за период, по всем клиентам.
	InvoicesCreated int64
	InvoicesPaid    int64
}

// AdminStatsHeatCell — выручка в конкретный час конкретного дня недели.
type AdminStatsHeatCell struct {
	Weekday    int // 1 — понедельник, 7 — воскресенье (ISODOW)
	Hour       int // 0..23
	RevenueRub float64
	Sales      int64
}

// AdminStatsLifetime — сколько живёт платящий клиент.
type AdminStatsLifetime struct {
	PayingCustomers int64
	// От первой оплаты до конца оплаченного периода (expire_at), в днях.
	AvgLifetimeDays float64
	// Сколько месяцев подписки куплено в сумме на одного платящего.
	AvgPaidMonths float64
	// Сколько оплат делает платящий клиент.
	AvgPurchases float64
}

// AdminStatsRenewals — продления против первых покупок за период.
type AdminStatsRenewals struct {
	FirstCount     int64
	FirstRevenue   float64
	RenewalCount   int64
	RenewalRevenue float64
}

// AdminStatsGateway — сколько принесла касса за окно.
type AdminStatsGateway struct {
	InvoiceType string
	RevenueRub  float64
	Payments    int64
}

// AdminStatsWindowTotals — итоги за окно. Считаются и за текущее окно, и за
// предыдущее такой же длины: без второго числа проценты роста неоткуда взять.
type AdminStatsWindowTotals struct {
	RevenueRub   float64
	Sales        int64
	NewUsers     int64
	Transactions int64
	UniquePayers int64
}

// AdminStatsInsights — ответ на один запрос.
type AdminStatsInsights struct {
	CapturedAt time.Time
	Period     string
	From       string
	To         string
	// Сдвиг часового пояса, в котором посчитана тепловая карта.
	TZOffsetMinutes int

	Funnel   AdminStatsFunnel
	Heatmap  []AdminStatsHeatCell
	Lifetime AdminStatsLifetime
	Renewals AdminStatsRenewals
	Gateways []AdminStatsGateway

	Current  AdminStatsWindowTotals
	Previous AdminStatsWindowTotals
}

// maxTZOffsetMinutes — реальные зоны укладываются в ±14 часов; всё за пределами
// приходит от испорченного клиента и обрезается.
const maxTZOffsetMinutes = 14 * 60

func clampTZOffset(minutes int) int {
	if minutes > maxTZOffsetMinutes {
		return maxTZOffsetMinutes
	}
	if minutes < -maxTZOffsetMinutes {
		return -maxTZOffsetMinutes
	}
	return minutes
}

// FetchAdminStatsInsights собирает метрики за окно [from, to).
// tzOffsetMinutes — сдвиг часового пояса админа относительно UTC (минуты на
// восток), нужен только тепловой карте: «продажи по часам» в UTC читать нельзя.
func (s *StatsRepository) FetchAdminStatsInsights(
	ctx context.Context,
	period string,
	from, to time.Time,
	tzOffsetMinutes int,
) (*AdminStatsInsights, error) {
	from = from.UTC()
	to = to.UTC()
	if !to.After(from) {
		return nil, fmt.Errorf("%w: empty window", ErrInvalidStatsTimeSeriesRange)
	}
	tzOffsetMinutes = clampTZOffset(tzOffsetMinutes)

	span := to.Sub(from)
	prevFrom := from.Add(-span)
	prevTo := from

	out := &AdminStatsInsights{
		CapturedAt:      time.Now().UTC(),
		Period:          period,
		From:            from.Format("2006-01-02"),
		To:              to.Add(-time.Nanosecond).Format("2006-01-02"),
		TZOffsetMinutes: tzOffsetMinutes,
	}

	if err := s.loadFunnel(ctx, from, to, &out.Funnel); err != nil {
		return nil, err
	}
	heat, err := s.loadRevenueHeatmap(ctx, from, to, tzOffsetMinutes)
	if err != nil {
		return nil, err
	}
	out.Heatmap = heat
	if err := s.loadLifetime(ctx, &out.Lifetime); err != nil {
		return nil, err
	}
	if err := s.loadRenewals(ctx, from, to, &out.Renewals); err != nil {
		return nil, err
	}
	gateways, err := s.loadGateways(ctx, from, to)
	if err != nil {
		return nil, err
	}
	out.Gateways = gateways
	if out.Current, err = s.loadWindowTotals(ctx, from, to); err != nil {
		return nil, err
	}
	if out.Previous, err = s.loadWindowTotals(ctx, prevFrom, prevTo); err != nil {
		return nil, err
	}

	return out, nil
}

func (s *StatsRepository) loadFunnel(ctx context.Context, from, to time.Time, dst *AdminStatsFunnel) error {
	q := `
SELECT
  COUNT(*),
  COALESCE(SUM(k.has_invoice), 0),
  COALESCE(SUM(k.has_paid), 0)
FROM (
  SELECT
    (CASE WHEN EXISTS (SELECT 1 FROM purchase p WHERE p.customer_id = c.id) THEN 1 ELSE 0 END) AS has_invoice,
    (CASE WHEN EXISTS (SELECT 1 FROM purchase p WHERE p.customer_id = c.id AND p.status = 'paid') THEN 1 ELSE 0 END) AS has_paid
  FROM customer c
  WHERE c.created_at >= $1 AND c.created_at < $2
) k`
	if err := s.pool.QueryRow(ctx, q, from, to).Scan(&dst.Registered, &dst.Invoiced, &dst.Paid); err != nil {
		return fmt.Errorf("stats funnel cohort: %w", err)
	}

	q = `
SELECT COUNT(*), COUNT(*) FILTER (WHERE p.status = 'paid')
FROM purchase p
WHERE p.created_at >= $1 AND p.created_at < $2`
	if err := s.pool.QueryRow(ctx, q, from, to).Scan(&dst.InvoicesCreated, &dst.InvoicesPaid); err != nil {
		return fmt.Errorf("stats funnel invoices: %w", err)
	}
	return nil
}

func (s *StatsRepository) loadRevenueHeatmap(ctx context.Context, from, to time.Time, tzOffsetMinutes int) ([]AdminStatsHeatCell, error) {
	// paid_at приводится к naive UTC и сдвигается вручную: EXTRACT из
	// timestamptz зависит от TimeZone сессии, а он здесь не наш.
	q := fmt.Sprintf(`
SELECT
  EXTRACT(ISODOW FROM s.local_at)::int AS dow,
  EXTRACT(HOUR FROM s.local_at)::int   AS hour,
  COALESCE(SUM(s.amount), 0)::float8,
  COUNT(*)
FROM (
  SELECT p.amount,
         (p.paid_at AT TIME ZONE 'UTC') + make_interval(mins => $3::int) AS local_at
  FROM purchase p
  WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
    AND p.paid_at >= $1 AND p.paid_at < $2
    AND %s
) s
GROUP BY dow, hour
ORDER BY dow, hour`, sqlRubCurrency)

	rows, err := s.pool.Query(ctx, q, from, to, tzOffsetMinutes)
	if err != nil {
		return nil, fmt.Errorf("stats revenue heatmap: %w", err)
	}
	defer rows.Close()

	cells := make([]AdminStatsHeatCell, 0, 32)
	for rows.Next() {
		var c AdminStatsHeatCell
		if err := rows.Scan(&c.Weekday, &c.Hour, &c.RevenueRub, &c.Sales); err != nil {
			return nil, err
		}
		cells = append(cells, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return cells, nil
}

func (s *StatsRepository) loadLifetime(ctx context.Context, dst *AdminStatsLifetime) error {
	// Считается по всей истории, а не за окно: срок жизни короче окна не бывает,
	// и «средний срок жизни за неделю» — бессмысленное число.
	q := fmt.Sprintf(`
WITH payers AS (
  SELECT p.customer_id AS cid,
         MIN(p.paid_at) AS first_paid,
         SUM(p.month)   AS months,
         COUNT(*)       AS purchases
  FROM purchase p
  WHERE %s AND p.paid_at IS NOT NULL
  GROUP BY p.customer_id
)
SELECT
  COUNT(*),
  COALESCE(AVG(GREATEST(EXTRACT(EPOCH FROM (COALESCE(c.expire_at, y.first_paid) - y.first_paid)) / 86400, 0)), 0)::float8,
  COALESCE(AVG(y.months), 0)::float8,
  COALESCE(AVG(y.purchases), 0)::float8
FROM payers y
JOIN customer c ON c.id = y.cid`, sqlSubPurchase)

	if err := s.pool.QueryRow(ctx, q).Scan(
		&dst.PayingCustomers, &dst.AvgLifetimeDays, &dst.AvgPaidMonths, &dst.AvgPurchases,
	); err != nil {
		return fmt.Errorf("stats lifetime: %w", err)
	}
	return nil
}

func (s *StatsRepository) loadRenewals(ctx context.Context, from, to time.Time, dst *AdminStatsRenewals) error {
	q := fmt.Sprintf(`
SELECT
  COUNT(*) FILTER (WHERE s.is_first),
  COALESCE(SUM(s.amount) FILTER (WHERE s.is_first), 0)::float8,
  COUNT(*) FILTER (WHERE NOT s.is_first),
  COALESCE(SUM(s.amount) FILTER (WHERE NOT s.is_first), 0)::float8
FROM (
  SELECT p.amount,
         NOT EXISTS (
           SELECT 1 FROM purchase q
           WHERE q.customer_id = p.customer_id
             AND q.status = 'paid' AND q.month > 0
             AND q.purchase_kind IN ('subscription', 'tariff_upgrade')
             AND q.paid_at IS NOT NULL AND q.paid_at < p.paid_at
         ) AS is_first
  FROM purchase p
  WHERE %s AND p.paid_at >= $1 AND p.paid_at < $2 AND %s
) s`, sqlSubPurchase, sqlRubCurrency)

	if err := s.pool.QueryRow(ctx, q, from, to).Scan(
		&dst.FirstCount, &dst.FirstRevenue, &dst.RenewalCount, &dst.RenewalRevenue,
	); err != nil {
		return fmt.Errorf("stats renewals split: %w", err)
	}
	return nil
}

// loadGateways — разбивка по способам оплаты за окно. В снимке такая разбивка
// есть только за всё время, а фильтр периода должен менять и её.
func (s *StatsRepository) loadGateways(ctx context.Context, from, to time.Time) ([]AdminStatsGateway, error) {
	q := fmt.Sprintf(`
SELECT p.invoice_type::text, COALESCE(SUM(p.amount), 0)::float8, COUNT(*)
FROM purchase p
WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
  AND p.paid_at >= $1 AND p.paid_at < $2 AND %s
GROUP BY p.invoice_type
ORDER BY 2 DESC`, sqlRubCurrency)

	rows, err := s.pool.Query(ctx, q, from, to)
	if err != nil {
		return nil, fmt.Errorf("stats gateways: %w", err)
	}
	defer rows.Close()

	out := make([]AdminStatsGateway, 0, 8)
	for rows.Next() {
		var g AdminStatsGateway
		if err := rows.Scan(&g.InvoiceType, &g.RevenueRub, &g.Payments); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *StatsRepository) loadWindowTotals(ctx context.Context, from, to time.Time) (AdminStatsWindowTotals, error) {
	var w AdminStatsWindowTotals
	q := fmt.Sprintf(`
SELECT
  (SELECT COALESCE(SUM(p.amount), 0)::float8 FROM purchase p
     WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2 AND %s),
  (SELECT COUNT(*) FROM purchase p WHERE %s AND p.paid_at >= $1 AND p.paid_at < $2),
  (SELECT COUNT(*) FROM customer c WHERE c.created_at >= $1 AND c.created_at < $2),
  (SELECT COUNT(*) FROM purchase p WHERE p.status = 'paid' AND p.paid_at >= $1 AND p.paid_at < $2),
  (SELECT COUNT(DISTINCT p.customer_id) FROM purchase p
     WHERE p.status = 'paid' AND p.paid_at IS NOT NULL AND p.paid_at >= $1 AND p.paid_at < $2 AND %s)`,
		sqlRubCurrency, sqlSubPurchase, sqlRubCurrency)

	if err := s.pool.QueryRow(ctx, q, from, to).Scan(
		&w.RevenueRub, &w.Sales, &w.NewUsers, &w.Transactions, &w.UniquePayers,
	); err != nil {
		return w, fmt.Errorf("stats window totals: %w", err)
	}
	return w, nil
}
