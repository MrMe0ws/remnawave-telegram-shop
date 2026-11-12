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
	_, ok := c.AdminTelegramID(ctx, accountID)
	return ok
}

// AdminTelegramID — Telegram id, под которым аккаунт признан админом. Нужен
// журналу «Мониторинга»: видно, кто из админов что сделал.
func (c *Checker) AdminTelegramID(ctx context.Context, accountID int64) (int64, bool) {
	if len(config.GetAdminTelegramIds()) == 0 {
		return 0, false
	}

	ids, err := c.ids.ListLinkedByAccount(ctx, accountID)
	if err != nil {
		slog.Warn("admin checker: list identities", "account_id", accountID, "error", err)
		return 0, false
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
		if config.IsAdminTelegramID(v) {
			return v, true
		}
	}
	return 0, false
}
