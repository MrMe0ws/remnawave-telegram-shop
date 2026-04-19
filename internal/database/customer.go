package database

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"remnawave-tg-shop-bot/utils"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/pgxpool"
)

type CustomerRepository struct {
	pool *pgxpool.Pool
}

func NewCustomerRepository(poll *pgxpool.Pool) *CustomerRepository {
	return &CustomerRepository{pool: poll}
}

// customerSelectColumns порядок полей для SELECT (не использовать * — совместимость со схемой).
const customerSelectColumns = "id, telegram_id, expire_at, created_at, subscription_link, language, extra_hwid, extra_hwid_expires_at, current_tariff_id, subscription_period_start, subscription_period_months"

type Customer struct {
	ID                        int64      `db:"id"`
	TelegramID                int64      `db:"telegram_id"`
	ExpireAt                  *time.Time `db:"expire_at"`
	CreatedAt                 time.Time  `db:"created_at"`
	SubscriptionLink          *string    `db:"subscription_link"`
	Language                  string     `db:"language"`
	ExtraHwid                 int        `db:"extra_hwid"`
	ExtraHwidExpiresAt        *time.Time `db:"extra_hwid_expires_at"`
	CurrentTariffID           *int64     `db:"current_tariff_id"`
	SubscriptionPeriodStart   *time.Time `db:"subscription_period_start"`
	SubscriptionPeriodMonths  *int       `db:"subscription_period_months"`
}

// BroadcastRecipient is a Telegram user with language for localized broadcast keyboards.
type BroadcastRecipient struct {
	TelegramID int64
	Language   string
}

// Broadcast audience filters for GetBroadcastRecipients.
const (
	BroadcastAudienceAll           = "all"
	BroadcastAudienceActive        = "active" // deprecated: используйте ActiveAll
	BroadcastAudienceInactive      = "inactive"
	BroadcastAudienceActivePaid    = "active_paid"
	BroadcastAudienceActiveTrial   = "active_trial"
	BroadcastAudienceActiveAll     = "active_all"
	BroadcastAudienceInactivePaid   = "inactive_paid"
	BroadcastAudienceInactiveTrial  = "inactive_trial"
	BroadcastAudienceInactiveAll    = "inactive_all"
)

func (cr *CustomerRepository) FindByExpirationRange(ctx context.Context, startDate, endDate time.Time) (*[]Customer, error) {
	buildSelect := sq.Select(customerSelectColumns).
		From("customer").
		Where(
			sq.And{
				sq.NotEq{"expire_at": nil},
				sq.GtOrEq{"expire_at": startDate},
				sq.LtOrEq{"expire_at": endDate},
			},
		).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query customers by expiration range: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	for rows.Next() {
		var customer Customer
		err := rows.Scan(
			&customer.ID,
			&customer.TelegramID,
			&customer.ExpireAt,
			&customer.CreatedAt,
			&customer.SubscriptionLink,
			&customer.Language,
			&customer.ExtraHwid,
			&customer.ExtraHwidExpiresAt,
			&customer.CurrentTariffID,
			&customer.SubscriptionPeriodStart,
			&customer.SubscriptionPeriodMonths,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan customer row: %w", err)
		}
		customers = append(customers, customer)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over customer rows: %w", err)
	}

	return &customers, nil
}

func (cr *CustomerRepository) FindById(ctx context.Context, id int64) (*Customer, error) {
	buildSelect := sq.Select(customerSelectColumns).
		From("customer").
		Where(sq.Eq{"id": id}).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	var customer Customer

	err = cr.pool.QueryRow(ctx, sql, args...).Scan(
		&customer.ID,
		&customer.TelegramID,
		&customer.ExpireAt,
		&customer.CreatedAt,
		&customer.SubscriptionLink,
		&customer.Language,
		&customer.ExtraHwid,
		&customer.ExtraHwidExpiresAt,
		&customer.CurrentTariffID,
		&customer.SubscriptionPeriodStart,
		&customer.SubscriptionPeriodMonths,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query customer: %w", err)
	}
	return &customer, nil
}

func (cr *CustomerRepository) FindByTelegramId(ctx context.Context, telegramId int64) (*Customer, error) {
	buildSelect := sq.Select(customerSelectColumns).
		From("customer").
		Where(sq.Eq{"telegram_id": telegramId}).
		PlaceholderFormat(sq.Dollar)

	sql, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	var customer Customer

	err = cr.pool.QueryRow(ctx, sql, args...).Scan(
		&customer.ID,
		&customer.TelegramID,
		&customer.ExpireAt,
		&customer.CreatedAt,
		&customer.SubscriptionLink,
		&customer.Language,
		&customer.ExtraHwid,
		&customer.ExtraHwidExpiresAt,
		&customer.CurrentTariffID,
		&customer.SubscriptionPeriodStart,
		&customer.SubscriptionPeriodMonths,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query customer: %w", err)
	}
	return &customer, nil
}

func (cr *CustomerRepository) Create(ctx context.Context, customer *Customer) (*Customer, error) {
	return cr.FindOrCreate(ctx, customer)
}

func (cr *CustomerRepository) FindOrCreate(ctx context.Context, customer *Customer) (*Customer, error) {
	query := `
	INSERT INTO customer (telegram_id, expire_at, language)
	VALUES ($1, $2, $3)
	ON CONFLICT (telegram_id) DO UPDATE SET telegram_id = customer.telegram_id
	RETURNING id, telegram_id, expire_at, created_at, subscription_link, language, extra_hwid, extra_hwid_expires_at, current_tariff_id, subscription_period_start, subscription_period_months
	`

	row := cr.pool.QueryRow(ctx, query, customer.TelegramID, customer.ExpireAt, customer.Language)
	var result Customer
	if err := row.Scan(
		&result.ID,
		&result.TelegramID,
		&result.ExpireAt,
		&result.CreatedAt,
		&result.SubscriptionLink,
		&result.Language,
		&result.ExtraHwid,
		&result.ExtraHwidExpiresAt,
		&result.CurrentTariffID,
		&result.SubscriptionPeriodStart,
		&result.SubscriptionPeriodMonths,
	); err != nil {
		return nil, fmt.Errorf("failed to find or create customer: %w", err)
	}

	slog.Info("user found or created in bot database", "telegramId", utils.MaskHalfInt64(result.TelegramID))
	return &result, nil
}

func (cr *CustomerRepository) UpdateFields(ctx context.Context, id int64, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	buildUpdate := sq.Update("customer").
		PlaceholderFormat(sq.Dollar).
		Where(sq.Eq{"id": id})

	for field, value := range updates {
		buildUpdate = buildUpdate.Set(field, value)
	}

	sql, args, err := buildUpdate.ToSql()
	if err != nil {
		return fmt.Errorf("failed to build update query: %w", err)
	}

	tx, err := cr.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	result, err := cr.pool.Exec(ctx, sql, args...)
	if err != nil {
		if err := tx.Rollback(ctx); err != nil {
			return fmt.Errorf("failed to rollback transaction: %w", err)
		}
		return fmt.Errorf("failed to update customer: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no customer found with id: %s", utils.MaskHalfInt64(id))
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func (cr *CustomerRepository) FindByTelegramIds(ctx context.Context, telegramIDs []int64) ([]Customer, error) {
	buildSelect := sq.Select(customerSelectColumns).
		From("customer").
		Where(sq.Eq{"telegram_id": telegramIDs}).
		PlaceholderFormat(sq.Dollar)

	sqlStr, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query customers: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	for rows.Next() {
		var customer Customer
		err := rows.Scan(
			&customer.ID,
			&customer.TelegramID,
			&customer.ExpireAt,
			&customer.CreatedAt,
			&customer.SubscriptionLink,
			&customer.Language,
			&customer.ExtraHwid,
			&customer.ExtraHwidExpiresAt,
			&customer.CurrentTariffID,
			&customer.SubscriptionPeriodStart,
			&customer.SubscriptionPeriodMonths,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan customer row: %w", err)
		}
		customers = append(customers, customer)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over customer rows: %w", err)
	}

	return customers, nil
}

func (cr *CustomerRepository) CreateBatch(ctx context.Context, customers []Customer) error {
	if len(customers) == 0 {
		return nil
	}
	builder := sq.Insert("customer").
		Columns("telegram_id", "expire_at", "language", "subscription_link").
		PlaceholderFormat(sq.Dollar)
	for _, cust := range customers {
		builder = builder.Values(cust.TelegramID, cust.ExpireAt, cust.Language, cust.SubscriptionLink)
	}
	sqlStr, args, err := builder.ToSql()
	if err != nil {
		return fmt.Errorf("failed to build batch insert query: %w", err)
	}

	tx, err := cr.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	_, err = cr.pool.Exec(ctx, sqlStr, args...)
	if err != nil {
		if err := tx.Rollback(ctx); err != nil {
			return fmt.Errorf("failed to rollback transaction: %w", err)
		}
		return fmt.Errorf("failed to execute batch insert: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func (cr *CustomerRepository) UpdateBatch(ctx context.Context, customers []Customer) error {
	if len(customers) == 0 {
		return nil
	}
	query := "UPDATE customer SET expire_at = c.expire_at, subscription_link = c.subscription_link FROM (VALUES "
	var args []interface{}
	for i, cust := range customers {
		if i > 0 {
			query += ", "
		}
		query += fmt.Sprintf("($%d::bigint, $%d::timestamp, $%d::text)", i*3+1, i*3+2, i*3+3)
		args = append(args, cust.TelegramID, cust.ExpireAt, cust.SubscriptionLink)
	}
	query += ") AS c(telegram_id, expire_at, subscription_link) WHERE customer.telegram_id = c.telegram_id"

	tx, err := cr.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	_, err = cr.pool.Exec(ctx, query, args...)
	if err != nil {
		if err := tx.Rollback(ctx); err != nil {
			return fmt.Errorf("failed to rollback transaction: %w", err)
		}
		return fmt.Errorf("failed to execute batch update: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func (cr *CustomerRepository) DeleteByNotInTelegramIds(ctx context.Context, telegramIDs []int64) error {
	var buildDelete sq.DeleteBuilder
	if len(telegramIDs) == 0 {
		buildDelete = sq.Delete("customer")
	} else {
		buildDelete = sq.Delete("customer").
			PlaceholderFormat(sq.Dollar).
			Where(sq.NotEq{"telegram_id": telegramIDs})
	}

	sqlStr, args, err := buildDelete.ToSql()
	if err != nil {
		return fmt.Errorf("failed to build delete query: %w", err)
	}

	_, err = cr.pool.Exec(ctx, sqlStr, args...)
	if err != nil {
		return fmt.Errorf("failed to delete customers: %w", err)
	}

	return nil

}

func (cr *CustomerRepository) GetAllTelegramIds(ctx context.Context) ([]int64, error) {
	buildSelect := sq.Select("telegram_id").
		From("customer").
		PlaceholderFormat(sq.Dollar)

	sqlStr, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query telegram ids: %w", err)
	}
	defer rows.Close()

	var telegramIDs []int64
	for rows.Next() {
		var telegramID int64
		err := rows.Scan(&telegramID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan telegram id row: %w", err)
		}
		telegramIDs = append(telegramIDs, telegramID)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over telegram id rows: %w", err)
	}

	return telegramIDs, nil
}

func (cr *CustomerRepository) GetActiveTelegramIds(ctx context.Context) ([]int64, error) {
	now := time.Now()
	buildSelect := sq.Select("telegram_id").
		From("customer").
		Where(
			sq.And{
				sq.NotEq{"expire_at": nil},
				sq.Gt{"expire_at": now},
			},
		).
		PlaceholderFormat(sq.Dollar)

	sqlStr, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query active telegram ids: %w", err)
	}
	defer rows.Close()

	var telegramIDs []int64
	for rows.Next() {
		var telegramID int64
		err := rows.Scan(&telegramID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan telegram id row: %w", err)
		}
		telegramIDs = append(telegramIDs, telegramID)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over telegram id rows: %w", err)
	}

	return telegramIDs, nil
}

func (cr *CustomerRepository) GetInactiveTelegramIds(ctx context.Context) ([]int64, error) {
	now := time.Now()
	buildSelect := sq.Select("telegram_id").
		From("customer").
		Where(
			sq.Or{
				sq.Eq{"expire_at": nil},
				sq.LtOrEq{"expire_at": now},
			},
		).
		PlaceholderFormat(sq.Dollar)

	sqlStr, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query inactive telegram ids: %w", err)
	}
	defer rows.Close()

	var telegramIDs []int64
	for rows.Next() {
		var telegramID int64
		err := rows.Scan(&telegramID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan telegram id row: %w", err)
		}
		telegramIDs = append(telegramIDs, telegramID)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over telegram id rows: %w", err)
	}

	return telegramIDs, nil
}

// GetBroadcastRecipients returns telegram_id and language for mass broadcast (button labels per user).
func (cr *CustomerRepository) GetBroadcastRecipients(ctx context.Context, audience string) ([]BroadcastRecipient, error) {
	now := time.Now()
	buildSelect := sq.Select("telegram_id", "language").
		From("customer").
		PlaceholderFormat(sq.Dollar)

	activeVPN := sq.And{sq.NotEq{"expire_at": nil}, sq.Gt{"expire_at": now}}
	inactiveVPN := sq.Or{sq.Eq{"expire_at": nil}, sq.LtOrEq{"expire_at": now}}
	paidSubscription := sq.Expr(`EXISTS (SELECT 1 FROM purchase p WHERE p.customer_id = customer.id AND p.status = 'paid' AND p.month > 0)`)
	noPaidSubscription := sq.Expr(`NOT EXISTS (SELECT 1 FROM purchase p WHERE p.customer_id = customer.id AND p.status = 'paid' AND p.month > 0)`)

	switch audience {
	case BroadcastAudienceAll:
		// no extra filter
	case BroadcastAudienceActive, BroadcastAudienceActiveAll:
		buildSelect = buildSelect.Where(activeVPN)
	case BroadcastAudienceInactive, BroadcastAudienceInactiveAll:
		buildSelect = buildSelect.Where(inactiveVPN)
	case BroadcastAudienceActivePaid:
		buildSelect = buildSelect.Where(sq.And{activeVPN, paidSubscription})
	case BroadcastAudienceActiveTrial:
		buildSelect = buildSelect.Where(sq.And{activeVPN, noPaidSubscription})
	case BroadcastAudienceInactivePaid:
		buildSelect = buildSelect.Where(sq.And{inactiveVPN, paidSubscription})
	case BroadcastAudienceInactiveTrial:
		buildSelect = buildSelect.Where(sq.And{inactiveVPN, noPaidSubscription})
	default:
		return nil, fmt.Errorf("unknown broadcast audience: %s", audience)
	}

	sqlStr, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("failed to build select query: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query broadcast recipients: %w", err)
	}
	defer rows.Close()

	var out []BroadcastRecipient
	for rows.Next() {
		var r BroadcastRecipient
		var lang string
		err := rows.Scan(&r.TelegramID, &lang)
		if err != nil {
			return nil, fmt.Errorf("failed to scan broadcast recipient: %w", err)
		}
		if lang != "" {
			r.Language = lang
		} else {
			r.Language = "en"
		}
		out = append(out, r)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating broadcast recipients: %w", err)
	}

	return out, nil
}

// FindActiveByCurrentTariffID возвращает клиентов с активной подпиской и указанным current_tariff_id.
func (cr *CustomerRepository) FindActiveByCurrentTariffID(ctx context.Context, tariffID int64) ([]Customer, error) {
	now := time.Now().UTC()
	buildSelect := sq.Select(customerSelectColumns).
		From("customer").
		Where(sq.And{
			sq.Eq{"current_tariff_id": tariffID},
			sq.NotEq{"expire_at": nil},
			sq.Gt{"expire_at": now},
		}).
		PlaceholderFormat(sq.Dollar)

	sqlStr, args, err := buildSelect.ToSql()
	if err != nil {
		return nil, fmt.Errorf("build select active by tariff: %w", err)
	}

	rows, err := cr.pool.Query(ctx, sqlStr, args...)
	if err != nil {
		return nil, fmt.Errorf("query active by tariff: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	for rows.Next() {
		var customer Customer
		err = rows.Scan(
			&customer.ID,
			&customer.TelegramID,
			&customer.ExpireAt,
			&customer.CreatedAt,
			&customer.SubscriptionLink,
			&customer.Language,
			&customer.ExtraHwid,
			&customer.ExtraHwidExpiresAt,
			&customer.CurrentTariffID,
			&customer.SubscriptionPeriodStart,
			&customer.SubscriptionPeriodMonths,
		)
		if err != nil {
			return nil, fmt.Errorf("scan customer: %w", err)
		}
		customers = append(customers, customer)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return customers, nil
}
