package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
)

// Merge audit actor/result — enum значения cabinet_merge_audit.
const (
	MergeActorUser   = "user"
	MergeActorSystem = "system"
	MergeActorAdmin  = "admin"

	MergeResultLinked  = "linked"
	MergeResultMerged  = "merged"
	MergeResultDryRun  = "dry_run"
	MergeResultRejected = "rejected"
)

// MergeAudit — строка cabinet_merge_audit.
type MergeAudit struct {
	ID               int64
	AccountID        int64
	SourceCustomerID *int64
	TargetCustomerID *int64
	Actor            string
	Result           string
	Reason           *string
	DryRun           bool
	IdempotencyKey   string
	CreatedAt        time.Time
}

// MergeAuditRepo — репозиторий cabinet_merge_audit.
type MergeAuditRepo struct {
	pool *pgxpool.Pool
}

// NewMergeAuditRepo — конструктор.
func NewMergeAuditRepo(pool *pgxpool.Pool) *MergeAuditRepo {
	return &MergeAuditRepo{pool: pool}
}

const mergeAuditSelectCols = "id, account_id, source_customer_id, target_customer_id, actor, result, reason, dry_run, idempotency_key, created_at"

func scanMergeAudit(row pgx.Row) (*MergeAudit, error) {
	var m MergeAudit
	err := row.Scan(
		&m.ID,
		&m.AccountID,
		&m.SourceCustomerID,
		&m.TargetCustomerID,
		&m.Actor,
		&m.Result,
		&m.Reason,
		&m.DryRun,
		&m.IdempotencyKey,
		&m.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan merge_audit: %w", err)
	}
	return &m, nil
}

// CreateInput — параметры для создания записи аудита.
type MergeAuditCreateInput struct {
	AccountID        int64
	SourceCustomerID *int64
	TargetCustomerID *int64
	Actor            string
	Result           string
	Reason           string
	DryRun           bool
	IdempotencyKey   string
}

// Create вставляет запись. При коллизии по (account_id, idempotency_key) возвращает
// ErrMergeAuditConflict — вызывающий код читает существующую запись и возвращает её.
var ErrMergeAuditConflict = errors.New("repository: merge_audit idempotency key conflict")

// Create вставляет новую запись аудита. Если idempotency_key уже существует для
// этого account_id, возвращает ErrMergeAuditConflict.
func (r *MergeAuditRepo) Create(ctx context.Context, tx pgx.Tx, in MergeAuditCreateInput) (*MergeAudit, error) {
	const q = `
		INSERT INTO cabinet_merge_audit
			(account_id, source_customer_id, target_customer_id, actor, result, reason, dry_run, idempotency_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING ` + mergeAuditSelectCols

	var reasonArg any
	if in.Reason != "" {
		reasonArg = in.Reason
	}

	var row pgx.Row
	if tx != nil {
		row = tx.QueryRow(ctx, q,
			in.AccountID, in.SourceCustomerID, in.TargetCustomerID,
			in.Actor, in.Result, reasonArg, in.DryRun, in.IdempotencyKey)
	} else {
		row = r.pool.QueryRow(ctx, q,
			in.AccountID, in.SourceCustomerID, in.TargetCustomerID,
			in.Actor, in.Result, reasonArg, in.DryRun, in.IdempotencyKey)
	}

	m, err := scanMergeAudit(row)
	if err != nil {
		// pgx wraps unique violation — проверяем текст ошибки.
		if isUniqueViolation(err) {
			return nil, ErrMergeAuditConflict
		}
		return nil, err
	}
	return m, nil
}

// FindByIdempotencyKey находит запись по (account_id, idempotency_key).
// Используется при повторном вызове confirm для идемпотентного ответа.
func (r *MergeAuditRepo) FindByIdempotencyKey(ctx context.Context, accountID int64, key string) (*MergeAudit, error) {
	const q = `SELECT ` + mergeAuditSelectCols +
		` FROM cabinet_merge_audit WHERE account_id = $1 AND idempotency_key = $2`
	return scanMergeAudit(r.pool.QueryRow(ctx, q, accountID, key))
}

// isUniqueViolation — простая проверка кода ошибки PostgreSQL 23505 (unique_violation).
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	return fmt.Sprintf("%v", err) == "" ||
		contains(err.Error(), "23505") ||
		contains(err.Error(), "unique_violation") ||
		contains(err.Error(), "duplicate key")
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && indexStr(s, sub) >= 0)
}

func indexStr(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
