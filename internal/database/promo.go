package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
)

// PendingDiscountUnlimitedPayments — значение subscription_payments_remaining: безлимит оплат до истечения TTL.
const PendingDiscountUnlimitedPayments = -1

const (
	PromoTypeSubscriptionDays = "subscription_days"
	PromoTypeTrial            = "trial"
	PromoTypeExtraHwid        = "extra_hwid"
	PromoTypeDiscount         = "discount"
)

type PromoCode struct {
	ID                         int64      `db:"id"`
	Code                       string     `db:"code"`
	Type                       string     `db:"type"`
	SubscriptionDays           *int       `db:"subscription_days"`
	TrialDays                  *int       `db:"trial_days"`
	ExtraHwidDelta             *int       `db:"extra_hwid_delta"`
	DiscountPercent            *int       `db:"discount_percent"`
	DiscountTTLHours           *int       `db:"discount_ttl_hours"`
	MaxUses                    *int       `db:"max_uses"`
	UsesCount                  int        `db:"uses_count"`
	ValidUntil                 *time.Time `db:"valid_until"`
	Active                     bool       `db:"active"`
	FirstPurchaseOnly          bool       `db:"first_purchase_only"`
	RequireCustomerInDB        bool       `db:"require_customer_in_db"`
	AllowTrialWithoutPayment   bool       `db:"allow_trial_without_payment"`
	CreatedAt                  time.Time  `db:"created_at"`
	DiscountMaxSubscriptionPaymentsPerCustomer int    `db:"discount_max_subscription_payments_per_customer"`
	TariffID                   *int64     `db:"tariff_id"`
}

type PromoRedemption struct {
	ID          int64     `db:"id"`
	PromoCodeID int64     `db:"promo_code_id"`
	CustomerID  int64     `db:"customer_id"`
	UsedAt      time.Time `db:"used_at"`
}

type PendingDiscount struct {
	ID                  int64      `db:"id"`
	CustomerID          int64      `db:"customer_id"`
	PromoCodeID         int64      `db:"promo_code_id"`
	Percent             int        `db:"percent"`
	ExpiresAt           *time.Time `db:"expires_at"`
	UntilFirstPurchase  bool       `db:"until_first_purchase"`
	CreatedAt           time.Time  `db:"created_at"`
	SubscriptionPaymentsRemaining int `db:"subscription_payments_remaining"`
}

type PromoRepository struct {
	pool *pgxpool.Pool
}

func NewPromoRepository(pool *pgxpool.Pool) *PromoRepository {
	return &PromoRepository{pool: pool}
}

func (r *PromoRepository) Create(ctx context.Context, p *PromoCode) (int64, error) {
	builder := sq.Insert("promo_code").
		Columns(
			"code", "type", "subscription_days", "trial_days", "extra_hwid_delta",
			"discount_percent", "discount_ttl_hours", "max_uses", "uses_count", "valid_until",
			"active", "first_purchase_only", "require_customer_in_db", "allow_trial_without_payment",
			"discount_max_subscription_payments_per_customer", "tariff_id",
		).
		Values(
			p.Code, p.Type, p.SubscriptionDays, p.TrialDays, p.ExtraHwidDelta,
			p.DiscountPercent, p.DiscountTTLHours, p.MaxUses, p.UsesCount, p.ValidUntil,
			p.Active, p.FirstPurchaseOnly, p.RequireCustomerInDB, p.AllowTrialWithoutPayment,
			p.DiscountMaxSubscriptionPaymentsPerCustomer, p.TariffID,
		).
		Suffix("RETURNING id").
		PlaceholderFormat(sq.Dollar)
	sqlStr, args, err := builder.ToSql()
	if err != nil {
		return 0, err
	}
	var id int64
	err = r.pool.QueryRow(ctx, sqlStr, args...).Scan(&id)
	return id, err
}

func (r *PromoRepository) FindByID(ctx context.Context, id int64) (*PromoCode, error) {
	return r.scanOne(ctx, sq.Select(
		"id", "code", "type", "subscription_days", "trial_days", "extra_hwid_delta",
		"discount_percent", "discount_ttl_hours", "max_uses", "uses_count", "valid_until",
		"active", "first_purchase_only", "require_customer_in_db", "allow_trial_without_payment", "created_at",
		"discount_max_subscription_payments_per_customer", "tariff_id",
	).From("promo_code").Where(sq.Eq{"id": id}).PlaceholderFormat(sq.Dollar))
}

func (r *PromoRepository) FindByCode(ctx context.Context, codeUpper string) (*PromoCode, error) {
	return r.scanOne(ctx, sq.Select(
		"id", "code", "type", "subscription_days", "trial_days", "extra_hwid_delta",
		"discount_percent", "discount_ttl_hours", "max_uses", "uses_count", "valid_until",
		"active", "first_purchase_only", "require_customer_in_db", "allow_trial_without_payment", "created_at",
		"discount_max_subscription_payments_per_customer", "tariff_id",
	).From("promo_code").Where(sq.Eq{"code": codeUpper}).PlaceholderFormat(sq.Dollar))
}

func (r *PromoRepository) scanOne(ctx context.Context, builder sq.SelectBuilder) (*PromoCode, error) {
	sqlStr, args, err := builder.ToSql()
	if err != nil {
		return nil, err
	}
	row := r.pool.QueryRow(ctx, sqlStr, args...)
	var p PromoCode
	var tid sql.NullInt64
	err = row.Scan(
		&p.ID, &p.Code, &p.Type, &p.SubscriptionDays, &p.TrialDays, &p.ExtraHwidDelta,
		&p.DiscountPercent, &p.DiscountTTLHours, &p.MaxUses, &p.UsesCount, &p.ValidUntil,
		&p.Active, &p.FirstPurchaseOnly, &p.RequireCustomerInDB, &p.AllowTrialWithoutPayment, &p.CreatedAt,
		&p.DiscountMaxSubscriptionPaymentsPerCustomer, &tid,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if tid.Valid {
		v := tid.Int64
		p.TariffID = &v
	}
	return &p, nil
}

func (r *PromoRepository) List(ctx context.Context, offset, limit int) ([]PromoCode, int, error) {
	countQ := sq.Select("COUNT(*)").From("promo_code").PlaceholderFormat(sq.Dollar)
	csql, cargs, _ := countQ.ToSql()
	var total int
	if err := r.pool.QueryRow(ctx, csql, cargs...).Scan(&total); err != nil {
		return nil, 0, err
	}
	builder := sq.Select(
		"id", "code", "type", "subscription_days", "trial_days", "extra_hwid_delta",
		"discount_percent", "discount_ttl_hours", "max_uses", "uses_count", "valid_until",
		"active", "first_purchase_only", "require_customer_in_db", "allow_trial_without_payment", "created_at",
		"discount_max_subscription_payments_per_customer", "tariff_id",
	).From("promo_code").OrderBy("id DESC").Offset(uint64(offset)).Limit(uint64(limit)).PlaceholderFormat(sq.Dollar)
	sqlStr, args, err := builder.ToSql()
	if err != nil {
		return nil, 0, err
	}
	rows, err := r.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var list []PromoCode
	for rows.Next() {
		var p PromoCode
		var tid sql.NullInt64
		if err := rows.Scan(
			&p.ID, &p.Code, &p.Type, &p.SubscriptionDays, &p.TrialDays, &p.ExtraHwidDelta,
			&p.DiscountPercent, &p.DiscountTTLHours, &p.MaxUses, &p.UsesCount, &p.ValidUntil,
			&p.Active, &p.FirstPurchaseOnly, &p.RequireCustomerInDB, &p.AllowTrialWithoutPayment, &p.CreatedAt,
			&p.DiscountMaxSubscriptionPaymentsPerCustomer, &tid,
		); err != nil {
			return nil, 0, err
		}
		if tid.Valid {
			v := tid.Int64
			p.TariffID = &v
		}
		list = append(list, p)
	}
	return list, total, rows.Err()
}

func (r *PromoRepository) CountTotals(ctx context.Context) (total, active, inactive int, err error) {
	err = r.pool.QueryRow(ctx, `SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE active)::int, COUNT(*) FILTER (WHERE NOT active)::int FROM promo_code`).Scan(&total, &active, &inactive)
	return
}

func (r *PromoRepository) UpdateFields(ctx context.Context, id int64, fields map[string]interface{}) error {
	if len(fields) == 0 {
		return nil
	}
	builder := sq.Update("promo_code").SetMap(fields).Where(sq.Eq{"id": id}).PlaceholderFormat(sq.Dollar)
	sqlStr, args, err := builder.ToSql()
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, sqlStr, args...)
	return err
}

func (r *PromoRepository) Delete(ctx context.Context, id int64) error {
	sqlStr, args, err := sq.Delete("promo_code").Where(sq.Eq{"id": id}).PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, sqlStr, args...)
	return err
}

func (r *PromoRepository) HasRedemption(ctx context.Context, promoID, customerID int64) (bool, error) {
	sqlStr, args, err := sq.Select("1").From("promo_redemption").
		Where(sq.Eq{"promo_code_id": promoID, "customer_id": customerID}).Limit(1).PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return false, err
	}
	var one int
	err = r.pool.QueryRow(ctx, sqlStr, args...).Scan(&one)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *PromoRepository) CountRedemptions(ctx context.Context, promoID int64) (int, error) {
	sqlStr, args, err := sq.Select("COUNT(*)").From("promo_redemption").Where(sq.Eq{"promo_code_id": promoID}).PlaceholderFormat(sq.Dollar).ToSql()
	if err != nil {
		return 0, err
	}
	var n int
	err = r.pool.QueryRow(ctx, sqlStr, args...).Scan(&n)
	return n, err
}

func (r *PromoRepository) CountRedemptionsToday(ctx context.Context, promoID int64) (int, error) {
	start := time.Now().UTC().Truncate(24 * time.Hour)
	q := `SELECT COUNT(*) FROM promo_redemption WHERE promo_code_id = $1 AND used_at >= $2`
	var n int
	err := r.pool.QueryRow(ctx, q, promoID, start).Scan(&n)
	return n, err
}

type PromoRedemptionRow struct {
	UsedAt     time.Time `db:"used_at"`
	TelegramID int64     `db:"telegram_id"`
}

func (r *PromoRepository) ListRecentRedemptions(ctx context.Context, promoID int64, limit int) ([]PromoRedemptionRow, error) {
	q := `
SELECT pr.used_at, c.telegram_id
FROM promo_redemption pr
JOIN customer c ON c.id = pr.customer_id
WHERE pr.promo_code_id = $1
ORDER BY pr.used_at DESC
LIMIT $2`
	rows, err := r.pool.Query(ctx, q, promoID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PromoRedemptionRow
	for rows.Next() {
		var row PromoRedemptionRow
		if err := rows.Scan(&row.UsedAt, &row.TelegramID); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// FindByCodeForUpdate locks promo row by normalized code.
func (r *PromoRepository) FindByCodeForUpdate(ctx context.Context, tx pgx.Tx, codeUpper string) (*PromoCode, error) {
	q := `SELECT id, code, type, subscription_days, trial_days, extra_hwid_delta,
		discount_percent, discount_ttl_hours, max_uses, uses_count, valid_until,
		active, first_purchase_only, require_customer_in_db, allow_trial_without_payment, created_at,
		discount_max_subscription_payments_per_customer, tariff_id
		FROM promo_code WHERE code = $1 FOR UPDATE`
	row := tx.QueryRow(ctx, q, codeUpper)
	var p PromoCode
	var tid sql.NullInt64
	err := row.Scan(
		&p.ID, &p.Code, &p.Type, &p.SubscriptionDays, &p.TrialDays, &p.ExtraHwidDelta,
		&p.DiscountPercent, &p.DiscountTTLHours, &p.MaxUses, &p.UsesCount, &p.ValidUntil,
		&p.Active, &p.FirstPurchaseOnly, &p.RequireCustomerInDB, &p.AllowTrialWithoutPayment, &p.CreatedAt,
		&p.DiscountMaxSubscriptionPaymentsPerCustomer, &tid,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if tid.Valid {
		v := tid.Int64
		p.TariffID = &v
	}
	return &p, nil
}

// FindByIDForUpdate loads promo row inside transaction with FOR UPDATE lock.
func (r *PromoRepository) FindByIDForUpdate(ctx context.Context, tx pgx.Tx, id int64) (*PromoCode, error) {
	q := `SELECT id, code, type, subscription_days, trial_days, extra_hwid_delta,
		discount_percent, discount_ttl_hours, max_uses, uses_count, valid_until,
		active, first_purchase_only, require_customer_in_db, allow_trial_without_payment, created_at,
		discount_max_subscription_payments_per_customer, tariff_id
		FROM promo_code WHERE id = $1 FOR UPDATE`
	row := tx.QueryRow(ctx, q, id)
	var p PromoCode
	var tid sql.NullInt64
	err := row.Scan(
		&p.ID, &p.Code, &p.Type, &p.SubscriptionDays, &p.TrialDays, &p.ExtraHwidDelta,
		&p.DiscountPercent, &p.DiscountTTLHours, &p.MaxUses, &p.UsesCount, &p.ValidUntil,
		&p.Active, &p.FirstPurchaseOnly, &p.RequireCustomerInDB, &p.AllowTrialWithoutPayment, &p.CreatedAt,
		&p.DiscountMaxSubscriptionPaymentsPerCustomer, &tid,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if tid.Valid {
		v := tid.Int64
		p.TariffID = &v
	}
	return &p, nil
}

func (r *PromoRepository) InsertRedemption(ctx context.Context, tx pgx.Tx, promoID, customerID int64) error {
	_, err := tx.Exec(ctx, `INSERT INTO promo_redemption (promo_code_id, customer_id) VALUES ($1, $2)`, promoID, customerID)
	return err
}

func (r *PromoRepository) IncrementUses(ctx context.Context, tx pgx.Tx, promoID int64) error {
	_, err := tx.Exec(ctx, `UPDATE promo_code SET uses_count = uses_count + 1 WHERE id = $1`, promoID)
	return err
}

func (r *PromoRepository) DeleteRedemption(ctx context.Context, tx pgx.Tx, promoID, customerID int64) error {
	_, err := tx.Exec(ctx, `DELETE FROM promo_redemption WHERE promo_code_id = $1 AND customer_id = $2`, promoID, customerID)
	return err
}

func (r *PromoRepository) DecrementUses(ctx context.Context, tx pgx.Tx, promoID int64) error {
	_, err := tx.Exec(ctx, `UPDATE promo_code SET uses_count = GREATEST(uses_count - 1, 0) WHERE id = $1`, promoID)
	return err
}

func (r *PromoRepository) GetPendingDiscountByCustomerID(ctx context.Context, customerID int64) (*PendingDiscount, error) {
	q := `SELECT id, customer_id, promo_code_id, percent, expires_at, until_first_purchase, created_at, subscription_payments_remaining
		FROM customer_pending_discount WHERE customer_id = $1`
	row := r.pool.QueryRow(ctx, q, customerID)
	var d PendingDiscount
	err := row.Scan(&d.ID, &d.CustomerID, &d.PromoCodeID, &d.Percent, &d.ExpiresAt, &d.UntilFirstPurchase, &d.CreatedAt, &d.SubscriptionPaymentsRemaining)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &d, nil
}

func (r *PromoRepository) UpsertPendingDiscount(ctx context.Context, tx pgx.Tx, customerID, promoCodeID int64, percent int, expiresAt *time.Time, untilFirst bool, subscriptionPaymentsRemaining int) error {
	_, err := tx.Exec(ctx, `
INSERT INTO customer_pending_discount (customer_id, promo_code_id, percent, expires_at, until_first_purchase, subscription_payments_remaining)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (customer_id) DO UPDATE SET
  promo_code_id = EXCLUDED.promo_code_id,
  percent = EXCLUDED.percent,
  expires_at = EXCLUDED.expires_at,
  until_first_purchase = EXCLUDED.until_first_purchase,
  subscription_payments_remaining = EXCLUDED.subscription_payments_remaining,
  created_at = CURRENT_TIMESTAMP
`, customerID, promoCodeID, percent, expiresAt, untilFirst, subscriptionPaymentsRemaining)
	return err
}

// GetPendingDiscountByCustomerIDForUpdate блокирует строку pending discount в транзакции.
func (r *PromoRepository) GetPendingDiscountByCustomerIDForUpdate(ctx context.Context, tx pgx.Tx, customerID int64) (*PendingDiscount, error) {
	q := `SELECT id, customer_id, promo_code_id, percent, expires_at, until_first_purchase, created_at, subscription_payments_remaining
		FROM customer_pending_discount WHERE customer_id = $1 FOR UPDATE`
	row := tx.QueryRow(ctx, q, customerID)
	var d PendingDiscount
	err := row.Scan(&d.ID, &d.CustomerID, &d.PromoCodeID, &d.Percent, &d.ExpiresAt, &d.UntilFirstPurchase, &d.CreatedAt, &d.SubscriptionPaymentsRemaining)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &d, nil
}

// UpdatePendingDiscountRemainingTx обновляет счётчик оставшихся оплат подписки со скидкой.
func (r *PromoRepository) UpdatePendingDiscountRemainingTx(ctx context.Context, tx pgx.Tx, customerID int64, remaining int) error {
	_, err := tx.Exec(ctx, `UPDATE customer_pending_discount SET subscription_payments_remaining = $2 WHERE customer_id = $1`, customerID, remaining)
	return err
}

func (r *PromoRepository) DeletePendingDiscount(ctx context.Context, customerID int64) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM customer_pending_discount WHERE customer_id = $1`, customerID)
	return err
}

func (r *PromoRepository) DeletePendingDiscountTx(ctx context.Context, tx pgx.Tx, customerID int64) error {
	_, err := tx.Exec(ctx, `DELETE FROM customer_pending_discount WHERE customer_id = $1`, customerID)
	return err
}

// Pool exposes underlying pool for transactions from service layer.
func (r *PromoRepository) Pool() *pgxpool.Pool {
	return r.pool
}

// ErrPromoValidation is returned when activation fails (maps to neutral user message).
var ErrPromoValidation = errors.New("promo validation failed")

func ValidationErrorf(format string, args ...interface{}) error {
	return fmt.Errorf("%w: %s", ErrPromoValidation, fmt.Sprintf(format, args...))
}
