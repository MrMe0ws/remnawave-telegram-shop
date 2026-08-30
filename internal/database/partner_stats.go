package database

import (
	"context"
	"fmt"
	"time"
)

// PartnerSummary — сводка для главного экрана кабинета партнёра.
type PartnerSummary struct {
	Customers         int
	CustomersLastWeek int
	PayingCustomers   int
	ActiveCustomers   int
	EarnedTotal       float64
	EarnedLastMonth   float64
}

// ConversionPercent — доля приведённых, кто хоть раз заплатил.
func (s PartnerSummary) ConversionPercent() int {
	if s.Customers <= 0 {
		return 0
	}
	return int(float64(s.PayingCustomers)*100/float64(s.Customers) + 0.5)
}

// PartnerMonthPoint — точка графика начислений.
type PartnerMonthPoint struct {
	Month  time.Time
	Amount float64
}

// PartnerLinkStats — ссылка вместе с тем, что она принесла. Ради этих трёх
// чисел потоки и заводятся: без них партнёр не отличит окупившуюся площадку от
// слитого бюджета.
type PartnerLinkStats struct {
	Link      PartnerLink
	Customers int
	Paying    int
	Earned    float64
}

// PartnerCustomerRow — строка списка приведённых клиентов.
type PartnerCustomerRow struct {
	CustomerID       int64
	TelegramID       int64
	TelegramUsername *string
	Email            *string
	IsWebOnly        bool
	Active           bool
	HasPaid          bool
	Earned           float64
	LinkName         *string
	AttachedAt       time.Time
}

// PartnerEarningRow — строка ленты начислений вместе с подписью клиента и
// названием потока.
type PartnerEarningRow struct {
	PartnerEarning
	CustomerTelegramID *int64
	CustomerUsername   *string
	CustomerEmail      *string
	CustomerIsWebOnly  bool
	LinkName           *string
}

// Summary собирает сводку одним запросом. Пять отдельных запросов на каждое
// открытие экрана — это пять раундтрипов там, где хватает одного.
func (r *PartnerRepository) Summary(ctx context.Context, partnerID int64) (PartnerSummary, error) {
	var s PartnerSummary
	err := r.pool.QueryRow(ctx, `
SELECT
  (SELECT COUNT(*) FROM partner_attribution WHERE partner_id = $1),
  (SELECT COUNT(*) FROM partner_attribution
    WHERE partner_id = $1 AND attached_at >= now() - interval '7 days'),
  (SELECT COUNT(DISTINCT a.customer_id)
     FROM partner_attribution a
     JOIN purchase p ON p.customer_id = a.customer_id AND p.status = $2
    WHERE a.partner_id = $1),
  (SELECT COUNT(*)
     FROM partner_attribution a
     JOIN customer c ON c.id = a.customer_id
    WHERE a.partner_id = $1 AND c.expire_at IS NOT NULL AND c.expire_at > now()),
  (SELECT COALESCE(SUM(amount), 0) FROM partner_earning
    WHERE partner_id = $1 AND status <> 'cancelled'),
  (SELECT COALESCE(SUM(amount), 0) FROM partner_earning
    WHERE partner_id = $1 AND status <> 'cancelled' AND created_at >= now() - interval '30 days')`,
		partnerID, PurchaseStatusPaid,
	).Scan(&s.Customers, &s.CustomersLastWeek, &s.PayingCustomers, &s.ActiveCustomers,
		&s.EarnedTotal, &s.EarnedLastMonth)
	if err != nil {
		return PartnerSummary{}, fmt.Errorf("failed to load partner summary: %w", err)
	}
	return s, nil
}

// EarningsByMonth — начисления по месяцам для графика. Отменённые исключены:
// график показывает заработанное, а не заявленное.
func (r *PartnerRepository) EarningsByMonth(ctx context.Context, partnerID int64, months int) ([]PartnerMonthPoint, error) {
	if months <= 0 {
		months = 6
	}
	rows, err := r.pool.Query(ctx, `
SELECT date_trunc('month', created_at) AS m, COALESCE(SUM(amount), 0)
  FROM partner_earning
 WHERE partner_id = $1
   AND status <> 'cancelled'
   AND created_at >= date_trunc('month', now()) - make_interval(months => $2)
 GROUP BY m
 ORDER BY m`, partnerID, months-1)
	if err != nil {
		return nil, fmt.Errorf("failed to load partner monthly earnings: %w", err)
	}
	defer rows.Close()

	var out []PartnerMonthPoint
	for rows.Next() {
		var p PartnerMonthPoint
		if err := rows.Scan(&p.Month, &p.Amount); err != nil {
			return nil, fmt.Errorf("failed to scan partner monthly earnings: %w", err)
		}
		out = append(out, p)
	}
	if rows.Err() != nil {
		return nil, fmt.Errorf("error iterating partner monthly earnings: %w", rows.Err())
	}
	return out, nil
}

// ListLinksWithStats возвращает все ссылки партнёра, включая архивные: архив
// продолжает приносить деньги с уже приведённых клиентов, и прятать его
// значило бы прятать часть дохода.
func (r *PartnerRepository) ListLinksWithStats(ctx context.Context, partnerID int64) ([]PartnerLinkStats, error) {
	rows, err := r.pool.Query(ctx, `
SELECT l.id, l.partner_id, l.code, l.name, l.is_default, l.archived_at, l.created_at,
       (SELECT COUNT(*) FROM partner_attribution a WHERE a.link_id = l.id),
       (SELECT COUNT(DISTINCT a.customer_id)
          FROM partner_attribution a
          JOIN purchase p ON p.customer_id = a.customer_id AND p.status = $2
         WHERE a.link_id = l.id),
       (SELECT COALESCE(SUM(e.amount), 0)
          FROM partner_earning e WHERE e.link_id = l.id AND e.status <> 'cancelled')
  FROM partner_link l
 WHERE l.partner_id = $1
 ORDER BY l.is_default DESC, l.archived_at NULLS FIRST, l.created_at`,
		partnerID, PurchaseStatusPaid)
	if err != nil {
		return nil, fmt.Errorf("failed to list partner links: %w", err)
	}
	defer rows.Close()

	var out []PartnerLinkStats
	for rows.Next() {
		var s PartnerLinkStats
		if err := rows.Scan(&s.Link.ID, &s.Link.PartnerID, &s.Link.Code, &s.Link.Name,
			&s.Link.IsDefault, &s.Link.ArchivedAt, &s.Link.CreatedAt,
			&s.Customers, &s.Paying, &s.Earned); err != nil {
			return nil, fmt.Errorf("failed to scan partner link stats: %w", err)
		}
		out = append(out, s)
	}
	if rows.Err() != nil {
		return nil, fmt.Errorf("error iterating partner link stats: %w", rows.Err())
	}
	return out, nil
}

// ListCustomers — приведённые клиенты с пагинацией. Второе значение — общее
// количество: без него у списка не бывает честной пагинации.
func (r *PartnerRepository) ListCustomers(ctx context.Context, partnerID int64, limit, offset int) ([]PartnerCustomerRow, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM partner_attribution WHERE partner_id = $1`, partnerID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count partner customers: %w", err)
	}
	if limit <= 0 {
		limit = 50
	}

	rows, err := r.pool.Query(ctx, `
SELECT c.id, c.telegram_id, c.telegram_username, acc.email, c.is_web_only,
       (c.expire_at IS NOT NULL AND c.expire_at > now()) AS active,
       EXISTS (SELECT 1 FROM purchase p WHERE p.customer_id = c.id AND p.status = $2) AS has_paid,
       (SELECT COALESCE(SUM(e.amount), 0) FROM partner_earning e
         WHERE e.partner_id = a.partner_id AND e.customer_id = c.id AND e.status <> 'cancelled'),
       l.name, a.attached_at
  FROM partner_attribution a
  JOIN customer c ON c.id = a.customer_id
  LEFT JOIN partner_link l ON l.id = a.link_id
  LEFT JOIN cabinet_account_customer_link cl ON cl.customer_id = c.id
  LEFT JOIN cabinet_account acc ON acc.id = cl.account_id
 WHERE a.partner_id = $1
 ORDER BY a.attached_at DESC
 LIMIT $3 OFFSET $4`, partnerID, PurchaseStatusPaid, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list partner customers: %w", err)
	}
	defer rows.Close()

	var out []PartnerCustomerRow
	for rows.Next() {
		var row PartnerCustomerRow
		if err := rows.Scan(&row.CustomerID, &row.TelegramID, &row.TelegramUsername, &row.Email,
			&row.IsWebOnly, &row.Active, &row.HasPaid, &row.Earned, &row.LinkName, &row.AttachedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to scan partner customer row: %w", err)
		}
		out = append(out, row)
	}
	if rows.Err() != nil {
		return nil, 0, fmt.Errorf("error iterating partner customers: %w", rows.Err())
	}
	return out, total, nil
}

// ListEarnings — лента начислений с пагинацией.
func (r *PartnerRepository) ListEarnings(ctx context.Context, partnerID int64, limit, offset int) ([]PartnerEarningRow, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM partner_earning WHERE partner_id = $1`, partnerID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count partner earnings: %w", err)
	}
	if limit <= 0 {
		limit = 50
	}

	rows, err := r.pool.Query(ctx, `
SELECT e.id, e.partner_id, e.customer_id, e.purchase_id, e.link_id,
       e.base_amount, e.base_currency, e.base_amount_rub, e.percent, e.amount,
       e.kind, e.status, e.hold_until, e.note, e.created_at, e.released_at,
       c.telegram_id, c.telegram_username, acc.email, COALESCE(c.is_web_only, FALSE), l.name
  FROM partner_earning e
  LEFT JOIN customer c ON c.id = e.customer_id
  LEFT JOIN partner_link l ON l.id = e.link_id
  LEFT JOIN cabinet_account_customer_link cl ON cl.customer_id = c.id
  LEFT JOIN cabinet_account acc ON acc.id = cl.account_id
 WHERE e.partner_id = $1
 ORDER BY e.created_at DESC, e.id DESC
 LIMIT $2 OFFSET $3`, partnerID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list partner earnings: %w", err)
	}
	defer rows.Close()

	var out []PartnerEarningRow
	for rows.Next() {
		var row PartnerEarningRow
		if err := rows.Scan(&row.ID, &row.PartnerID, &row.CustomerID, &row.PurchaseID, &row.LinkID,
			&row.BaseAmount, &row.BaseCurrency, &row.BaseAmountRub, &row.Percent, &row.Amount,
			&row.Kind, &row.Status, &row.HoldUntil, &row.Note, &row.CreatedAt, &row.ReleasedAt,
			&row.CustomerTelegramID, &row.CustomerUsername, &row.CustomerEmail,
			&row.CustomerIsWebOnly, &row.LinkName); err != nil {
			return nil, 0, fmt.Errorf("failed to scan partner earning row: %w", err)
		}
		out = append(out, row)
	}
	if rows.Err() != nil {
		return nil, 0, fmt.Errorf("error iterating partner earnings: %w", rows.Err())
	}
	return out, total, nil
}

// NextHoldReleaseAt — когда раскроется ближайшее начисление в холде. Партнёр
// должен видеть дату, а не только сумму: «3 200 ₽ в холде» без «откроется 5-го»
// порождает обращение в поддержку.
func (r *PartnerRepository) NextHoldReleaseAt(ctx context.Context, partnerID int64) (*time.Time, error) {
	var at *time.Time
	if err := r.pool.QueryRow(ctx,
		`SELECT MIN(hold_until) FROM partner_earning
		  WHERE partner_id = $1 AND status = 'hold' AND hold_until IS NOT NULL`,
		partnerID).Scan(&at); err != nil {
		return nil, fmt.Errorf("failed to load next partner hold release: %w", err)
	}
	return at, nil
}

// SkippedStarsEarnings — сколько оплат звёздами прошло мимо начислений из-за
// незаданного RUB_PER_STAR. Считается по покупкам приведённых клиентов, для
// которых начисления нет: молча терять деньги партнёров нельзя, а признаться в
// этом можно только цифрой.
func (r *PartnerRepository) SkippedStarsEarnings(ctx context.Context) (int, error) {
	var n int
	if err := r.pool.QueryRow(ctx, `
SELECT COUNT(*)
  FROM purchase p
  JOIN partner_attribution a ON a.customer_id = p.customer_id
 WHERE p.status = $1
   AND upper(p.currency) IN ('XTR', 'STARS')
   AND p.paid_at >= a.attached_at
   AND NOT EXISTS (SELECT 1 FROM partner_earning e WHERE e.purchase_id = p.id)`,
		PurchaseStatusPaid).Scan(&n); err != nil {
		return 0, fmt.Errorf("failed to count skipped stars earnings: %w", err)
	}
	return n, nil
}
