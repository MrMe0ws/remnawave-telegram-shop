// Package adminauth проверяет, является ли аккаунт кабинета администратором.
//
// Логика: cabinet_identity(provider=telegram, unlinked_at IS NULL) →
// provider_user_id == ADMIN_TELEGRAM_ID. Без новых env — привязан ли Telegram
// аккаунта к тому же ID, что и в боте.
package adminauth

import (
	"context"
	"log/slog"
	"strconv"
	"strings"

	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
)

// Checker проверяет admin-статус аккаунта.
type Checker struct {
	ids *repository.IdentityRepo
}

// NewChecker создаёт Checker.
func NewChecker(ids *repository.IdentityRepo) *Checker {
	return &Checker{ids: ids}
}

// IsAdmin возвращает true, если у аккаунта есть привязанный Telegram identity
// с provider_user_id == ADMIN_TELEGRAM_ID.
func (c *Checker) IsAdmin(ctx context.Context, accountID int64) bool {
	adminTgID := config.GetAdminTelegramId()
	if adminTgID <= 0 {
		return false
	}

	ids, err := c.ids.ListLinkedByAccount(ctx, accountID)
	if err != nil {
		slog.Warn("admin checker: list identities", "account_id", accountID, "error", err)
		return false
	}

	for _, id := range ids {
		if id.Provider != repository.ProviderTelegram {
			continue
		}
		s := strings.TrimSpace(id.ProviderUserID)
		if s == "" {
			continue
		}
		v, perr := strconv.ParseInt(s, 10, 64)
		if perr != nil {
			continue
		}
		if v == adminTgID {
			return true
		}
	}
	return false
}
