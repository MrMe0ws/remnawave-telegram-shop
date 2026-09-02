package database

import (
	"context"
	"fmt"
	"time"
)

// Сводка партнёрской программы для админ-статистики.
//
// Экран партнёров отвечает на вопрос «что с этим партнёром»; статистике нужен
// другой — «что с программой в целом». Собирать её из ListPartnersByStatus
// постранично значило бы тянуть всю таблицу ради четырёх сумм, поэтому здесь
// свои агрегаты.

// PartnerProgramTopRow — партнёр в топе «кто приводит».
type PartnerProgramTopRow struct {
	PartnerID        int64
	CustomerID       int64
	TelegramID       int64
	TelegramUsername *string
	Nickname         *string
	Customers        int64
	PayingCustomers  int64
	Earned           float64
}

// PartnerProgramStats — агрегаты по всей программе.
type PartnerProgramStats struct {
	CapturedAt time.Time

	PartnersTotal     int64
	PartnersActive    int64
	PartnersPending   int64
	PartnersSuspended int64

	Customers       int64
	PayingCustomers int64
	ActiveCustomers int64

	// Начислено за всё время и за окно [from, to). Отменённые начисления
	// исключены везде: программа должна показывать выплаченное, а не заявленное.
	EarnedTotal  float64
	EarnedPeriod float64
	// Разбивка начислений за окно по виду: первая оплата против продлений.
	EarnedFirst   float64
	EarnedRenewal float64

	HoldBalance      float64
	AvailableBalance float64
	ReservedBalance  float64
	PaidTotal        float64

	OpenPayouts       int64
	OpenPayoutsAmount float64

	Top []PartnerProgramTopRow
}

// AdminProgramStats собирает сводку по программе за окно [from, to).
func (r *PartnerRepository) AdminProgramStats(ctx context.Context, from, to time.Time, topLimit int) (*PartnerProgramStats, error) {
	if topLimit <= 0 {
		topLimit = 10
	}

	out := &PartnerProgramStats{CapturedAt: time.Now().UTC()}

	err := r.pool.QueryRow(ctx, `
SELECT
  COUNT(*),
  COUNT(*) FILTER (WHERE status = 'active'),
  COUNT(*) FILTER (WHERE status = 'pending'),
  COUNT(*) FILTER (WHERE status = 'suspended'),
  COALESCE(SUM(total_earned), 0)::float8,
  COALESCE(SUM(hold_balance), 0)::float8,
  COALESCE(SUM(balance), 0)::float8,
  COALESCE(SUM(reserved_balance), 0)::float8,
  COALESCE(SUM(total_paid), 0)::float8
FROM partner`).Scan(
		&out.PartnersTotal, &out.PartnersActive, &out.PartnersPending, &out.PartnersSuspended,
		&out.EarnedTotal, &out.HoldBalance, &out.AvailableBalance, &out.ReservedBalance, &out.PaidTotal,
	)
	if err != nil {
		return nil, fmt.Errorf("partner program stats: partners: %w", err)
	}

	err = r.pool.QueryRow(ctx, `
SELECT
  (SELECT COUNT(*) FROM partner_attribution),
  (SELECT COUNT(DISTINCT a.customer_id)
     FROM partner_attribution a
     JOIN purchase p ON p.customer_id = a.customer_id AND p.status = $1),
  (SELECT COUNT(*)
     FROM partner_attribution a
     JOIN customer c ON c.id = a.customer_id
    WHERE c.expire_at IS NOT NULL AND c.expire_at > now())`,
		PurchaseStatusPaid,
	).Scan(&out.Customers, &out.PayingCustomers, &out.ActiveCustomers)
	if err != nil {
		return nil, fmt.Errorf("partner program stats: attribution: %w", err)
	}

	err = r.pool.QueryRow(ctx, `
SELECT
  COALESCE(SUM(amount), 0)::float8,
  COALESCE(SUM(amount) FILTER (WHERE kind = 'first'), 0)::float8,
  COALESCE(SUM(amount) FILTER (WHERE kind = 'renewal'), 0)::float8
FROM partner_earning
WHERE status <> 'cancelled' AND created_at >= $1 AND created_at < $2`,
		from, to,
	).Scan(&out.EarnedPeriod, &out.EarnedFirst, &out.EarnedRenewal)
	if err != nil {
		return nil, fmt.Errorf("partner program stats: earnings window: %w", err)
	}

	err = r.pool.QueryRow(ctx, `
SELECT COUNT(*), COALESCE(SUM(amount), 0)::float8
FROM partner_payout
WHERE status IN ('pending', 'approved')`).Scan(&out.OpenPayouts, &out.OpenPayoutsAmount)
	if err != nil {
		return nil, fmt.Errorf("partner program stats: payouts: %w", err)
	}

	top, err := r.topPartners(ctx, topLimit)
	if err != nil {
		return nil, err
	}
	out.Top = top

	return out, nil
}

func (r *PartnerRepository) topPartners(ctx context.Context, limit int) ([]PartnerProgramTopRow, error) {
	// Ник берётся так же, как в топе рефереров: из связанной учётки кабинета,
	// иначе у веб-партнёра в таблице пусто.
	rows, err := r.pool.Query(ctx, `
SELECT
  pa.id,
  c.id,
  COALESCE(c.telegram_id, 0),
  c.telegram_username,
  (SELECT NULLIF(TRIM(ii.raw_profile_json->>'first_name'), '')
     FROM cabinet_account_customer_link l
     JOIN cabinet_identity ii ON ii.account_id = l.account_id AND ii.unlinked_at IS NULL
    WHERE l.customer_id = c.id AND l.link_status = 'linked'
    ORDER BY ii.created_at DESC
    LIMIT 1) AS nickname,
  (SELECT COUNT(*) FROM partner_attribution a WHERE a.partner_id = pa.id),
  (SELECT COUNT(DISTINCT a.customer_id)
     FROM partner_attribution a
     JOIN purchase p ON p.customer_id = a.customer_id AND p.status = $2
    WHERE a.partner_id = pa.id),
  COALESCE(pa.total_earned, 0)::float8
FROM partner pa
JOIN customer c ON c.id = pa.customer_id
WHERE pa.status IN ('active', 'suspended')
ORDER BY pa.total_earned DESC, pa.id ASC
LIMIT $1`, limit, PurchaseStatusPaid)
	if err != nil {
		return nil, fmt.Errorf("partner program stats: top: %w", err)
	}
	defer rows.Close()

	list := make([]PartnerProgramTopRow, 0, limit)
	for rows.Next() {
		var row PartnerProgramTopRow
		if err := rows.Scan(
			&row.PartnerID, &row.CustomerID, &row.TelegramID, &row.TelegramUsername, &row.Nickname,
			&row.Customers, &row.PayingCustomers, &row.Earned,
		); err != nil {
			return nil, err
		}
		list = append(list, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}
