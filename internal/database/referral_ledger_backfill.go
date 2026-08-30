package database

import (
	"context"
	"log/slog"
	"time"

	"remnawave-tg-shop-bot/internal/config"
)

// BackfillReferralLedger восстанавливает журнал начислений по истории покупок.
//
// Нужен ровно один раз, при обновлении на версию с журналом. Без него все
// счётчики «заработано дней» у существующей установки обнулились бы в момент
// апдейта: экраны перестали бы пересчитывать историю из purchase и начали
// читать пустую таблицу.
//
// Восстановление ведётся по ПЛОСКОЙ формуле, без разбивки по месяцам, и это не
// упущение. До появления журнала помесячного начисления не существовало, и за
// годовую оплату реально начислялось столько же, сколько за месячную. Применить
// к истории новую формулу значило бы нарисовать людям дни, которых они не
// получали. Поэтому строки бэкфилла помечены is_backfilled и оставлены без
// помесячных ставок, а цифры сразу после обновления совпадают с теми, что
// показывал пересчёт накануне.
//
// Единственная неточность, которую нельзя устранить: базовые значения берутся
// текущие. Настройки, действовавшие в момент каждой конкретной оплаты, нигде не
// сохранялись — ровно этот порок пересчёта задним числом журнал и закрывает на
// будущее.
func BackfillReferralLedger(ctx context.Context, repo *ReferralBonusLedgerRepository) error {
	// Признак «уже выполнялся» — строки самого бэкфилла, а не пустота журнала:
	// см. HasBackfilledRows. Повтор безопасен, вставка идемпотентна.
	done, err := repo.HasBackfilledRows(ctx)
	if err != nil {
		return err
	}
	if done {
		return nil
	}

	grants, err := repo.ListHistoricalGrants(ctx)
	if err != nil {
		return err
	}
	if len(grants) == 0 {
		slog.Info("referral ledger backfill: no historical payments, nothing to restore")
		return nil
	}

	progressive := config.ReferralMode() == "progressive"
	entries := make([]ReferralBonusEntry, 0, len(grants))

	// В режиме default бонус разовый: один на связку, в момент первой оплаты
	// приглашённого. Дальнейшие его оплаты не приносили ничего.
	for _, g := range grants {
		referralID := g.ReferralID
		refereeCustomerID := g.RefereeCustomerID
		purchaseID := g.PurchaseID

		base := func(days int, kind string, recipientTG int64, recipientCustomer *int64) {
			if days <= 0 {
				return
			}
			entries = append(entries, ReferralBonusEntry{
				ReferralID:          &referralID,
				ReferrerTelegramID:  g.ReferrerTelegramID,
				RefereeTelegramID:   g.RefereeTelegramID,
				RecipientTelegramID: recipientTG,
				RecipientCustomerID: recipientCustomer,
				PurchaseID:          &purchaseID,
				Months:              g.Months,
				Days:                days,
				Kind:                kind,
				IsBackfilled:        true,
				CreatedAt:           g.PaidAt,
			})
		}

		if !progressive {
			if g.PaymentIndex == 1 {
				base(config.GetReferralDays(), ReferralBonusKindDefault, g.ReferrerTelegramID, nil)
			}
			continue
		}

		if g.PaymentIndex == 1 {
			base(config.ReferralFirstReferrerDays(), ReferralBonusKindFirstReferrer, g.ReferrerTelegramID, nil)
			// У приглашённого customer_id известен — это плательщик.
			base(config.ReferralFirstRefereeDays(), ReferralBonusKindFirstReferee, g.RefereeTelegramID, &refereeCustomerID)
			continue
		}
		base(config.ReferralRepeatReferrerDays(), ReferralBonusKindRepeatReferrer, g.ReferrerTelegramID, nil)
	}

	if len(entries) == 0 {
		slog.Info("referral ledger backfill: bonuses are configured as zero, nothing to restore")
		return nil
	}

	started := time.Now()
	if err := repo.InsertBatch(ctx, entries); err != nil {
		return err
	}
	slog.Info("referral ledger backfill completed",
		"rows", len(entries),
		"payments", len(grants),
		"mode", config.ReferralMode(),
		"took", time.Since(started).String(),
	)
	return nil
}
