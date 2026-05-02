package handler

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

// adminFindRWUserByCustomer находит пользователя Remnawave для карточки админки.
// Для обычных TG-пользователей ищем по telegram_id.
// Для web-only/synthetic добавляем fallback по subscription_link и username-prefix.
func (h Handler) adminFindRWUserByCustomer(ctx context.Context, cust *database.Customer) (*remnawave.User, error) {
	if cust == nil {
		return nil, fmt.Errorf("nil customer")
	}

	// Старый путь: реальный TG ID -> быстрый прямой lookup.
	if !cust.IsWebOnly && !utils.IsSyntheticTelegramID(cust.TelegramID) {
		u, err := h.remnawaveClient.GetUserTrafficInfo(ctx, cust.TelegramID)
		if err == nil && u != nil {
			return u, nil
		}
		if err != nil && !errors.Is(err, remnawave.ErrUserNotFound) {
			return nil, err
		}
	}

	all, err := h.remnawaveClient.GetUsers(ctx)
	if err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return nil, remnawave.ErrUserNotFound
	}

	subLink := ""
	if cust.SubscriptionLink != nil {
		subLink = strings.TrimSpace(*cust.SubscriptionLink)
	}
	if subLink != "" {
		for i := range all {
			if strings.TrimSpace(all[i].SubscriptionUrl) == subLink {
				return &all[i], nil
			}
		}
	}

	// username в панели для web-only формируется как "<customer_id>_<...>".
	usernamePrefix := fmt.Sprintf("%d_", cust.ID)
	for i := range all {
		if strings.HasPrefix(strings.TrimSpace(all[i].Username), usernamePrefix) {
			return &all[i], nil
		}
	}

	// Мягкий fallback для смешанных исторических записей.
	for i := range all {
		if all[i].TelegramID != nil && *all[i].TelegramID == cust.TelegramID {
			return &all[i], nil
		}
	}

	return nil, remnawave.ErrUserNotFound
}
