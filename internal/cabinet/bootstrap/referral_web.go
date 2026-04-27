package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"remnawave-tg-shop-bot/utils"
)

// ParseReferralTelegramID извлекает telegram_id реферера из query/body (формат как в боте: ref_<id> или число).
func ParseReferralTelegramID(raw string) int64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0
	}
	raw = strings.TrimPrefix(strings.TrimSpace(raw), "ref_")
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0
	}
	return id
}

// AttachReferralAfterWebRegister создаёт referral для нового аккаунта кабинета (referee = synthetic telegram нового customer).
// Идемпотентно: если у referee уже есть referral — no-op. Несуществующий referrer — no-op без ошибки.
func (b *CustomerBootstrap) AttachReferralAfterWebRegister(ctx context.Context, accountID int64, language string, referrerTelegramID int64) error {
	if b == nil || b.referralRepo == nil || referrerTelegramID <= 0 {
		return nil
	}

	link, err := b.EnsureForAccount(ctx, accountID, language)
	if err != nil {
		return err
	}

	refereeCustomer, err := b.customerRepo.FindById(ctx, link.CustomerID)
	if err != nil {
		return fmt.Errorf("bootstrap: load referee customer: %w", err)
	}
	if refereeCustomer == nil {
		return fmt.Errorf("bootstrap: referee customer %d missing", link.CustomerID)
	}

	refereeTG := refereeCustomer.TelegramID
	if referrerTelegramID == refereeTG {
		return nil
	}

	existing, err := b.referralRepo.FindByReferee(ctx, refereeTG)
	if err != nil {
		return fmt.Errorf("bootstrap: find referral by referee: %w", err)
	}
	if existing != nil {
		return nil
	}

	referrer, err := b.customerRepo.FindByTelegramId(ctx, referrerTelegramID)
	if err != nil {
		return fmt.Errorf("bootstrap: find referrer: %w", err)
	}
	if referrer == nil {
		return nil
	}

	if _, err := b.referralRepo.Create(ctx, referrerTelegramID, refereeTG); err != nil {
		return fmt.Errorf("bootstrap: create referral: %w", err)
	}

	slog.Info("cabinet: referral attached at web register",
		"account_id", accountID,
		"referrer_tg_masked", utils.MaskHalfInt64(referrerTelegramID),
		"referee_tg_masked", utils.MaskHalfInt64(refereeTG),
	)
	return nil
}
