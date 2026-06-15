package remnawave

import (
	"context"
	"strconv"
	"strings"

	"remnawave-tg-shop-bot/internal/database"
)

// CustomerIDFromPanelUsername extracts shop customer id from RW username "<id>_...".
func CustomerIDFromPanelUsername(username string) (int64, bool) {
	username = strings.TrimSpace(username)
	i := strings.Index(username, "_")
	if i <= 0 {
		return 0, false
	}
	id, err := strconv.ParseInt(username[:i], 10, 64)
	return id, err == nil && id > 0
}

// CustomerFromAdminSearchUser maps a Remnawave user (admin search hit) to a local customer row.
func CustomerFromAdminSearchUser(ctx context.Context, repo *database.CustomerRepository, u User) (*database.Customer, error) {
	if repo == nil {
		return nil, nil
	}
	if u.TelegramID != nil && *u.TelegramID > 0 {
		cust, err := repo.FindByTelegramId(ctx, *u.TelegramID)
		if err != nil || cust != nil {
			return cust, err
		}
	}
	if link := strings.TrimSpace(u.SubscriptionUrl); link != "" {
		cust, err := repo.FindBySubscriptionLink(ctx, link)
		if err != nil || cust != nil {
			return cust, err
		}
	}
	if id, ok := CustomerIDFromPanelUsername(u.Username); ok {
		return repo.FindById(ctx, id)
	}
	return nil, nil
}
