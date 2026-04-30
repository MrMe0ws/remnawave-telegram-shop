package database

import (
	"context"
	"errors"
	"fmt"
	"math"
	"remnawave-tg-shop-bot/internal/config"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
)

type Referral struct {
	ID           int64     `db:"id"`
	ReferrerID   int64     `db:"referrer_id"`
	RefereeID    int64     `db:"referee_id"`
	UsedAt       time.Time `db:"used_at"`
	BonusGranted bool      `db:"bonus_granted"`
}

type RefereeSummary struct {
	TelegramID        int64
	Active            bool
	TelegramUsername  *string
	Email             *string
}

type ReferralStats struct {
	Total           int
	Paid            int
	Active          int
	Conversion      int
	EarnedTotal     int
	EarnedLastMonth int
}

type ReferralRepository struct {
	pool *pgxpool.Pool
}

func NewReferralRepository(pool *pgxpool.Pool) *ReferralRepository {
	return &ReferralRepository{pool: pool}
}

func (r *ReferralRepository) Create(ctx context.Context, referrerID, refereeID int64) (*Referral, error) {
	query := sq.Insert("referral").
		Columns("referrer_id", "referee_id", "used_at", "bonus_granted").
		Values(referrerID, refereeID, sq.Expr("NOW()"), false).
		Suffix("RETURNING id, referrer_id, referee_id, used_at, bonus_granted").
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build insert referral query: %w", err)
	}

	row := r.pool.QueryRow(ctx, sql, args...)
	var ref Referral
	if err := row.Scan(&ref.ID, &ref.ReferrerID, &ref.RefereeID, &ref.UsedAt, &ref.BonusGranted); err != nil {
		return nil, fmt.Errorf("failed to scan inserted referral: %w", err)
	}
	return &ref, nil
}

func (r *ReferralRepository) FindByReferrer(ctx context.Context, referrerID int64) ([]Referral, error) {
	query := sq.Select("id", "referrer_id", "referee_id", "used_at", "bonus_granted").
		From("referral").
		Where(sq.Eq{"referrer_id": referrerID}).
		OrderBy("used_at DESC").
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select referrals by referrer query: %w", err)
	}

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query referrals by referrer: %w", err)
	}
	defer rows.Close()

	var list []Referral
	for rows.Next() {
		var ref Referral
		if err := rows.Scan(&ref.ID, &ref.ReferrerID, &ref.RefereeID, &ref.UsedAt, &ref.BonusGranted); err != nil {
			return nil, fmt.Errorf("failed to scan referral row: %w", err)
		}
		list = append(list, ref)
	}
	if rows.Err() != nil {
		return nil, fmt.Errorf("error iterating referral rows: %w", rows.Err())
	}
	return list, nil
}

func (r *ReferralRepository) CountByReferrer(ctx context.Context, referrerID int64) (int, error) {
	query := sq.Select("COUNT(*)").
		From("referral").
		Where(sq.Eq{"referrer_id": referrerID}).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, fmt.Errorf("failed to build count referrals by referrer query: %w", err)
	}

	var count int
	if err := r.pool.QueryRow(ctx, sql, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to scan count of referrals: %w", err)
	}
	return count, nil
}

// CountPaidReferralsByReferrer подсчитывает количество рефералов, которые оплатили подписку
func (r *ReferralRepository) CountPaidReferralsByReferrer(ctx context.Context, referrerID int64) (int, error) {
	query := sq.Select("COUNT(DISTINCT r.referee_id)").
		From("referral r").
		Join("customer c ON c.telegram_id = r.referee_id").
		Join("purchase p ON p.customer_id = c.id").
		Where(sq.Eq{"r.referrer_id": referrerID, "p.status": PurchaseStatusPaid}).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, fmt.Errorf("failed to build count paid referrals by referrer query: %w", err)
	}

	var count int
	if err := r.pool.QueryRow(ctx, sql, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to scan count of paid referrals: %w", err)
	}
	return count, nil
}

func (r *ReferralRepository) CountActiveReferralsByReferrer(ctx context.Context, referrerID int64) (int, error) {
	query := sq.Select("COUNT(*)").
		From("referral r").
		Join("customer c ON c.telegram_id = r.referee_id").
		Where(sq.Eq{"r.referrer_id": referrerID}).
		Where("c.expire_at IS NOT NULL AND c.expire_at > NOW()").
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return 0, fmt.Errorf("failed to build count active referrals query: %w", err)
	}

	var count int
	if err := r.pool.QueryRow(ctx, sql, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to scan count of active referrals: %w", err)
	}
	return count, nil
}

func (r *ReferralRepository) FindRefereeSummariesByReferrer(ctx context.Context, referrerID int64) ([]RefereeSummary, error) {
	query := sq.Select("r.referee_id", "c.expire_at", "c.telegram_username", "a.email").
		From("referral r").
		Join("customer c ON c.telegram_id = r.referee_id").
		LeftJoin("cabinet_account_customer_link l ON l.customer_id = c.id").
		LeftJoin("cabinet_account a ON a.id = l.account_id").
		Where(sq.Eq{"r.referrer_id": referrerID}).
		OrderBy("r.used_at DESC").
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select referral list query: %w", err)
	}

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query referral list: %w", err)
	}
	defer rows.Close()

	var list []RefereeSummary
	for rows.Next() {
		var refereeID int64
		var expireAt *time.Time
		var telegramUsername *string
		var email *string
		if err := rows.Scan(&refereeID, &expireAt, &telegramUsername, &email); err != nil {
			return nil, fmt.Errorf("failed to scan referral list row: %w", err)
		}
		active := expireAt != nil && expireAt.After(time.Now())
		list = append(list, RefereeSummary{
			TelegramID:       refereeID,
			Active:          active,
			TelegramUsername: telegramUsername,
			Email:           email,
		})
	}
	if rows.Err() != nil {
		return nil, fmt.Errorf("error iterating referral list rows: %w", rows.Err())
	}
	return list, nil
}

// CalculateEarnedDays рассчитывает количество заработанных дней по рефералам
func (r *ReferralRepository) CalculateEarnedDays(ctx context.Context, referrerID int64) (int, error) {
	paidCount, err := r.CountPaidReferralsByReferrer(ctx, referrerID)
	if err != nil {
		return 0, err
	}

	// Каждый оплативший реферал дает дни из конфигурации
	referralDays := config.GetReferralDays()
	earnedDays := paidCount * referralDays
	return earnedDays, nil
}

func (r *ReferralRepository) GetStats(ctx context.Context, referrerID int64) (ReferralStats, error) {
	totalCount, err := r.CountByReferrer(ctx, referrerID)
	if err != nil {
		return ReferralStats{}, err
	}
	paidCount, err := r.CountPaidReferralsByReferrer(ctx, referrerID)
	if err != nil {
		return ReferralStats{}, err
	}
	activeCount, err := r.CountActiveReferralsByReferrer(ctx, referrerID)
	if err != nil {
		return ReferralStats{}, err
	}

	conversion := 0
	if totalCount > 0 {
		conversion = int(math.Round(float64(paidCount) * 100 / float64(totalCount)))
	}

	earnedTotal, earnedLastMonth, err := r.calculateEarnedDays(ctx, referrerID, paidCount)
	if err != nil {
		return ReferralStats{}, err
	}

	return ReferralStats{
		Total:           totalCount,
		Paid:            paidCount,
		Active:          activeCount,
		Conversion:      conversion,
		EarnedTotal:     earnedTotal,
		EarnedLastMonth: earnedLastMonth,
	}, nil
}

type paidReferralSummary struct {
	TotalPaid     int
	PaidLastMonth int
	FirstPaidAt   time.Time
}

func (r *ReferralRepository) calculateEarnedDays(ctx context.Context, referrerID int64, paidCount int) (int, int, error) {
	cutoff := time.Now().AddDate(0, 0, -30)
	summaries, err := r.getPaidReferralSummaries(ctx, referrerID, cutoff)
	if err != nil {
		return 0, 0, err
	}

	mode := config.ReferralMode()
	if mode == "progressive" {
		firstReferrerDays := config.ReferralFirstReferrerDays()
		repeatReferrerDays := config.ReferralRepeatReferrerDays()

		earnedTotal := 0
		earnedLastMonth := 0
		for _, summary := range summaries {
			if summary.TotalPaid > 0 {
				earnedTotal += firstReferrerDays + maxInt(summary.TotalPaid-1, 0)*repeatReferrerDays
			}
			if summary.PaidLastMonth > 0 {
				if !summary.FirstPaidAt.Before(cutoff) {
					earnedLastMonth += firstReferrerDays + maxInt(summary.PaidLastMonth-1, 0)*repeatReferrerDays
				} else {
					earnedLastMonth += summary.PaidLastMonth * repeatReferrerDays
				}
			}
		}
		return earnedTotal, earnedLastMonth, nil
	}

	referralDays := config.GetReferralDays()
	earnedTotal := paidCount * referralDays
	earnedLastMonth := 0
	for _, summary := range summaries {
		if summary.TotalPaid > 0 && !summary.FirstPaidAt.Before(cutoff) {
			earnedLastMonth += referralDays
		}
	}
	return earnedTotal, earnedLastMonth, nil
}

func (r *ReferralRepository) getPaidReferralSummaries(ctx context.Context, referrerID int64, cutoff time.Time) (map[int64]paidReferralSummary, error) {
	query := sq.Select(
		"r.referee_id",
		"COUNT(p.id) AS total_paid",
		"MIN(p.paid_at) AS first_paid_at",
	).
		Column(sq.Expr("SUM(CASE WHEN p.paid_at >= ? THEN 1 ELSE 0 END) AS paid_last_month", cutoff)).
		From("referral r").
		Join("customer c ON c.telegram_id = r.referee_id").
		Join("purchase p ON p.customer_id = c.id").
		Where(sq.Eq{"r.referrer_id": referrerID, "p.status": PurchaseStatusPaid}).
		GroupBy("r.referee_id").
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build paid referral summaries query: %w", err)
	}

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query paid referral summaries: %w", err)
	}
	defer rows.Close()

	result := make(map[int64]paidReferralSummary)
	for rows.Next() {
		var refereeID int64
		var summary paidReferralSummary
		if err := rows.Scan(&refereeID, &summary.TotalPaid, &summary.FirstPaidAt, &summary.PaidLastMonth); err != nil {
			return nil, fmt.Errorf("failed to scan paid referral summary: %w", err)
		}
		result[refereeID] = summary
	}
	if rows.Err() != nil {
		return nil, fmt.Errorf("error iterating paid referral summaries: %w", rows.Err())
	}
	return result, nil
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (r *ReferralRepository) FindByReferee(ctx context.Context, refereeID int64) (*Referral, error) {
	query := sq.Select("id", "referrer_id", "referee_id", "used_at", "bonus_granted").
		From("referral").
		Where(sq.Eq{"referee_id": refereeID}).
		Limit(1).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select referral by referee query: %w", err)
	}

	var ref Referral
	err = r.pool.QueryRow(ctx, sql, args...).Scan(&ref.ID, &ref.ReferrerID, &ref.RefereeID, &ref.UsedAt, &ref.BonusGranted)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query referral by referee: %w", err)
	}
	return &ref, nil
}

func (r *ReferralRepository) MarkBonusGranted(ctx context.Context, referralID int64) error {
	query := sq.Update("referral").
		Set("bonus_granted", true).
		Where(sq.Eq{"id": referralID}).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := query.ToSql()
	if err != nil {
		return fmt.Errorf("failed to build update bonus_granted query: %w", err)
	}

	res, err := r.pool.Exec(ctx, sql, args...)
	if err != nil {
		return fmt.Errorf("failed to execute update bonus_granted: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("no referral record updated")
	}
	return nil
}
