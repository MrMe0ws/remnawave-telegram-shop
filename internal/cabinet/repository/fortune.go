package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
)

const fortunePromoCode = "__CABINET_FORTUNE__"

// FortuneRepo — лог спинов колеса фортуны.
type FortuneRepo struct {
	pool *pgxpool.Pool
}

func NewFortuneRepo(pool *pgxpool.Pool) *FortuneRepo {
	return &FortuneRepo{pool: pool}
}

func (r *FortuneRepo) Pool() *pgxpool.Pool { return r.pool }

// CountPaidSpinsBetween — платные спины (не бесплатный первый) за полуинтервал [start, end) в UTC.
func (r *FortuneRepo) CountPaidSpinsBetween(ctx context.Context, customerID int64, start, end time.Time) (int, error) {
	const q = `SELECT COUNT(*) FROM fortune_spins
WHERE customer_id = $1 AND is_free_spin = FALSE AND spin_at >= $2 AND spin_at < $3`
	var n int
	if err := r.pool.QueryRow(ctx, q, customerID, start, end).Scan(&n); err != nil {
		return 0, fmt.Errorf("fortune: count spins: %w", err)
	}
	return n, nil
}

// HasDailyFreeSpinToday — уже использован ежедневный бесплатный спин за UTC-сутки [dayStart, dayEnd).
func (r *FortuneRepo) HasDailyFreeSpinToday(ctx context.Context, customerID int64, dayStart, dayEnd time.Time) (bool, error) {
	const q = `SELECT EXISTS(
  SELECT 1 FROM fortune_spins
  WHERE customer_id = $1 AND COALESCE(is_daily_free, FALSE) = TRUE
    AND spin_at >= $2 AND spin_at < $3)`
	var ok bool
	if err := r.pool.QueryRow(ctx, q, customerID, dayStart, dayEnd).Scan(&ok); err != nil {
		return false, fmt.Errorf("fortune: has daily free today: %w", err)
	}
	return ok, nil
}

// FortuneSpinXPGain — начисление XP с колеса (reward_type xp|micro), для истории лояльности.
type FortuneSpinXPGain struct {
	ID          int64
	SpinAt      time.Time
	RewardType  string
	RewardValue int
}

// ListXPGainsByCustomer — спины с начислением XP, новые первые (без миграций: таблица fortune_spins).
func (r *FortuneRepo) ListXPGainsByCustomer(ctx context.Context, customerID int64, limit int) ([]FortuneSpinXPGain, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}
	const q = `SELECT id, spin_at, reward_type, reward_value
FROM fortune_spins
WHERE customer_id = $1 AND reward_type IN ('xp', 'micro') AND reward_value > 0
ORDER BY spin_at DESC, id DESC
LIMIT $2`
	rows, err := r.pool.Query(ctx, q, customerID, limit)
	if err != nil {
		return nil, fmt.Errorf("fortune: list xp spins: %w", err)
	}
	defer rows.Close()
	var out []FortuneSpinXPGain
	for rows.Next() {
		var row FortuneSpinXPGain
		if err := rows.Scan(&row.ID, &row.SpinAt, &row.RewardType, &row.RewardValue); err != nil {
			return nil, fmt.Errorf("fortune: scan xp spin: %w", err)
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *FortuneRepo) InsertSpin(ctx context.Context, customerID int64, rewardType string, rewardValue, costDays int, isFree, isDailyFree bool) error {
	const q = `INSERT INTO fortune_spins (customer_id, reward_type, reward_value, cost_days, is_free_spin, is_daily_free)
VALUES ($1, $2, $3, $4, $5, $6)`
	if _, err := r.pool.Exec(ctx, q, customerID, rewardType, rewardValue, costDays, isFree, isDailyFree); err != nil {
		return fmt.Errorf("fortune: insert spin: %w", err)
	}
	return nil
}

// FortunePromoCode — код якорного промо для pending-скидок колеса.
func FortunePromoCode() string { return fortunePromoCode }
