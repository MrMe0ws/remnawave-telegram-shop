package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
)

// EmailVerification — модель cabinet_email_verification.
type EmailVerification struct {
	ID        int64
	AccountID int64
	TokenHash []byte
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

// IsUsable — не истёк и не использован.
func (e *EmailVerification) IsUsable() bool {
	return e.UsedAt == nil && time.Now().Before(e.ExpiresAt)
}

// EmailVerificationRepo — cabinet_email_verification.
type EmailVerificationRepo struct {
	pool *pgxpool.Pool
}

// NewEmailVerificationRepo — конструктор.
func NewEmailVerificationRepo(pool *pgxpool.Pool) *EmailVerificationRepo {
	return &EmailVerificationRepo{pool: pool}
}

const evSelectCols = "id, account_id, token_hash, expires_at, used_at, created_at"

func scanEV(row pgx.Row) (*EmailVerification, error) {
	var e EmailVerification
	err := row.Scan(
		&e.ID,
		&e.AccountID,
		&e.TokenHash,
		&e.ExpiresAt,
		&e.UsedAt,
		&e.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan email verification: %w", err)
	}
	return &e, nil
}

// Create вставляет запись. Caller инвалидирует предыдущие токены через
// InvalidateForAccount перед созданием новой (resend).
func (r *EmailVerificationRepo) Create(ctx context.Context, accountID int64, tokenHash [32]byte, expiresAt time.Time) (*EmailVerification, error) {
	const q = `
		INSERT INTO cabinet_email_verification (account_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
		RETURNING ` + evSelectCols
	return scanEV(r.pool.QueryRow(ctx, q, accountID, tokenHash[:], expiresAt))
}

// FindByHash ищет токен по sha256. ErrNotFound — нет такого токена.
func (r *EmailVerificationRepo) FindByHash(ctx context.Context, tokenHash [32]byte) (*EmailVerification, error) {
	const q = `SELECT ` + evSelectCols + ` FROM cabinet_email_verification WHERE token_hash = $1`
	return scanEV(r.pool.QueryRow(ctx, q, tokenHash[:]))
}

// MarkUsed ставит used_at = NOW().
func (r *EmailVerificationRepo) MarkUsed(ctx context.Context, id int64) error {
	const q = `UPDATE cabinet_email_verification SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`
	_, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("mark ev used: %w", err)
	}
	return nil
}

// InvalidateForAccount — перед созданием нового кода «погасить» все
// предыдущие живые (так resend гарантированно даст ровно один рабочий токен).
func (r *EmailVerificationRepo) InvalidateForAccount(ctx context.Context, accountID int64) error {
	const q = `UPDATE cabinet_email_verification SET used_at = NOW() WHERE account_id = $1 AND used_at IS NULL`
	_, err := r.pool.Exec(ctx, q, accountID)
	if err != nil {
		return fmt.Errorf("invalidate ev: %w", err)
	}
	return nil
}
