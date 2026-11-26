package database

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// InfraNodeMeta — цена и период оплаты ноды (панель Remnawave их не хранит).
type InfraNodeMeta struct {
	NodeUUID     uuid.UUID
	Price        *float64
	PeriodMonths int
	UpdatedAt    time.Time
}

// InfraPaymentNode — нода, которую покрыла запись истории оплат панели.
type InfraPaymentNode struct {
	HistoryUUID uuid.UUID
	NodeUUID    uuid.UUID
	NodeName    string
	CountryCode string
	Amount      *float64
	BilledAt    time.Time
}

// ListNodeMeta — все цены/периоды по node_uuid.
func (r *InfraBillingRepository) ListNodeMeta(ctx context.Context) (map[uuid.UUID]InfraNodeMeta, error) {
	rows, err := r.pool.Query(ctx, `
SELECT node_uuid, price::float8, period_months, updated_at FROM admin_infra_node_meta`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[uuid.UUID]InfraNodeMeta)
	for rows.Next() {
		var m InfraNodeMeta
		if err := rows.Scan(&m.NodeUUID, &m.Price, &m.PeriodMonths, &m.UpdatedAt); err != nil {
			return nil, err
		}
		out[m.NodeUUID] = m
	}
	return out, rows.Err()
}

// UpsertNodeMeta сохраняет цену (nil — «не знаем») и период ноды.
func (r *InfraBillingRepository) UpsertNodeMeta(ctx context.Context, nodeUUID uuid.UUID, price *float64, periodMonths int) error {
	_, err := r.pool.Exec(ctx, `
INSERT INTO admin_infra_node_meta (node_uuid, price, period_months, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (node_uuid) DO UPDATE SET price = EXCLUDED.price, period_months = EXCLUDED.period_months, updated_at = NOW()`,
		nodeUUID, price, periodMonths)
	return err
}

// InsertPaymentNodes привязывает ноды к записи истории (одной транзакцией).
func (r *InfraBillingRepository) InsertPaymentNodes(ctx context.Context, items []InfraPaymentNode) error {
	if len(items) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, it := range items {
		batch.Queue(`
INSERT INTO admin_infra_payment_nodes (history_uuid, node_uuid, node_name, country_code, amount, billed_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (history_uuid, node_uuid) DO NOTHING`,
			it.HistoryUUID, it.NodeUUID, it.NodeName, it.CountryCode, it.Amount, it.BilledAt)
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := tx.SendBatch(ctx, batch).Close(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListPaymentNodes — привязки нод, сгруппированные по записи истории.
func (r *InfraBillingRepository) ListPaymentNodes(ctx context.Context) (map[uuid.UUID][]InfraPaymentNode, error) {
	rows, err := r.pool.Query(ctx, `
SELECT history_uuid, node_uuid, node_name, country_code, amount::float8, billed_at
FROM admin_infra_payment_nodes
ORDER BY billed_at DESC, node_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make(map[uuid.UUID][]InfraPaymentNode)
	for rows.Next() {
		var p InfraPaymentNode
		if err := rows.Scan(&p.HistoryUUID, &p.NodeUUID, &p.NodeName, &p.CountryCode, &p.Amount, &p.BilledAt); err != nil {
			return nil, err
		}
		out[p.HistoryUUID] = append(out[p.HistoryUUID], p)
	}
	return out, rows.Err()
}

// DeletePaymentNodes снимает привязки удалённой записи истории.
func (r *InfraBillingRepository) DeletePaymentNodes(ctx context.Context, historyUUID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM admin_infra_payment_nodes WHERE history_uuid = $1`, historyUUID)
	return err
}
