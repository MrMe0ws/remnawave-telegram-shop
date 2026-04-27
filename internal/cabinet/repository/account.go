// Package repository — доступ к cabinet_* таблицам через pgxpool.
//
// Нарочито простой слой: без ORM, без кодогенерации, с явными SQL-строками —
// как остальная часть проекта (см. internal/database).
package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
)

// ErrNotFound — запись не существует. Обёртка над pgx.ErrNoRows, чтобы сервисы
// не зависели от pgx напрямую.
var ErrNotFound = errors.New("repository: not found")

// AccountStatus — enum колонки cabinet_account.status.
const (
	AccountStatusActive  = "active"
	AccountStatusBlocked = "blocked"
)

// Account — модель cabinet_account.
type Account struct {
	ID              int64
	Email           *string // nullable (OAuth-only, telegram-login без email)
	EmailVerifiedAt *time.Time
	PasswordHash    *string // nullable (OAuth-only, без email+пароля)
	Language        string
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	LastLoginAt     *time.Time
}

// EmailVerified — для JWT, middleware и UI.
// Подтверждение по ссылке из письма — только если email задан; аккаунты без
// email (вход только через Telegram / без почты) нечего верифицировать — для
// гейта считаем это эквивалентом «порог пройден».
func (a *Account) EmailVerified() bool {
	if a.EmailVerifiedAt != nil {
		return true
	}
	if a.Email == nil {
		return true
	}
	return strings.TrimSpace(*a.Email) == ""
}

// AccountRepo — репозиторий cabinet_account.
type AccountRepo struct {
	pool *pgxpool.Pool
}

// NewAccountRepo — конструктор.
func NewAccountRepo(pool *pgxpool.Pool) *AccountRepo { return &AccountRepo{pool: pool} }

const accountSelectCols = "id, email, email_verified_at, password_hash, language, status, created_at, updated_at, last_login_at"

func scanAccount(row pgx.Row) (*Account, error) {
	var a Account
	err := row.Scan(
		&a.ID,
		&a.Email,
		&a.EmailVerifiedAt,
		&a.PasswordHash,
		&a.Language,
		&a.Status,
		&a.CreatedAt,
		&a.UpdatedAt,
		&a.LastLoginAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan account: %w", err)
	}
	return &a, nil
}

// Create вставляет новый аккаунт и возвращает заполненный объект (с id/created_at).
// email должен быть уже нормализован (lower-case, trim) вызывающим кодом.
func (r *AccountRepo) Create(ctx context.Context, email, passwordHash, language string) (*Account, error) {
	if language == "" {
		language = "ru"
	}
	const q = `
		INSERT INTO cabinet_account (email, password_hash, language, status)
		VALUES ($1, $2, $3, 'active')
		RETURNING ` + accountSelectCols
	var emailArg any
	if email != "" {
		emailArg = email
	}
	var hashArg any
	if passwordHash != "" {
		hashArg = passwordHash
	}
	row := r.pool.QueryRow(ctx, q, emailArg, hashArg, language)
	return scanAccount(row)
}

// FindByID возвращает аккаунт по первичному ключу.
func (r *AccountRepo) FindByID(ctx context.Context, id int64) (*Account, error) {
	const q = `SELECT ` + accountSelectCols + ` FROM cabinet_account WHERE id = $1`
	return scanAccount(r.pool.QueryRow(ctx, q, id))
}

// FindByEmail ищет аккаунт по email (case-insensitive). ErrNotFound, если нет.
func (r *AccountRepo) FindByEmail(ctx context.Context, email string) (*Account, error) {
	const q = `SELECT ` + accountSelectCols + ` FROM cabinet_account WHERE LOWER(email) = LOWER($1)`
	return scanAccount(r.pool.QueryRow(ctx, q, strings.TrimSpace(email)))
}

// MarkEmailVerified устанавливает email_verified_at=now(), если ещё не стоит.
// Идемпотентно.
func (r *AccountRepo) MarkEmailVerified(ctx context.Context, id int64) error {
	const q = `
		UPDATE cabinet_account
		   SET email_verified_at = COALESCE(email_verified_at, NOW()),
		       updated_at = NOW()
		 WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("mark email verified: %w", err)
	}
	return nil
}

// UpdatePasswordHash меняет хеш пароля и обновляет updated_at.
// Caller обязан после этого вызвать SessionRepo.RevokeAllForAccount, чтобы
// инвалидировать все refresh-сессии (обязательно при reset; опционально при
// смене пароля из кабинета).
func (r *AccountRepo) UpdatePasswordHash(ctx context.Context, id int64, hash string) error {
	const q = `UPDATE cabinet_account SET password_hash = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, id, hash)
	if err != nil {
		return fmt.Errorf("update password hash: %w", err)
	}
	return nil
}

// UpdateLastLogin — last_login_at = NOW().
func (r *AccountRepo) UpdateLastLogin(ctx context.Context, id int64) error {
	const q = `UPDATE cabinet_account SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, id)
	if err != nil {
		return fmt.Errorf("update last login: %w", err)
	}
	return nil
}

// UpdateLanguage меняет язык аккаунта (PUT /me/language).
func (r *AccountRepo) UpdateLanguage(ctx context.Context, id int64, lang string) error {
	if lang != "ru" && lang != "en" {
		return fmt.Errorf("unsupported language: %q", lang)
	}
	const q = `UPDATE cabinet_account SET language = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, q, id, lang)
	if err != nil {
		return fmt.Errorf("update language: %w", err)
	}
	return nil
}

// DeleteAccountForUser удаляет cabinet_account и все cabinet_* строки с CASCADE.
// Если у аккаунта в link сидит web-only customer — сначала удаляется customer
// (purchase и др. по FK CASCADE), затем аккаунт. Иначе удаляется только аккаунт,
// customer с реальным Telegram остаётся в боте.
func (r *AccountRepo) DeleteAccountForUser(ctx context.Context, accountID int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	const delWebCustomer = `
		DELETE FROM customer
		WHERE id = (
			SELECT customer_id FROM cabinet_account_customer_link WHERE account_id = $1
		) AND is_web_only = TRUE`
	if _, err := tx.Exec(ctx, delWebCustomer, accountID); err != nil {
		return fmt.Errorf("delete web-only customer: %w", err)
	}

	const delAcc = `DELETE FROM cabinet_account WHERE id = $1`
	tag, err := tx.Exec(ctx, delAcc, accountID)
	if err != nil {
		return fmt.Errorf("delete cabinet account: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete account: %w", err)
	}
	return nil
}
