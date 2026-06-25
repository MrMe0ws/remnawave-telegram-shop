package service

import (
	"context"
	"errors"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

// ResolveRemnawaveCustomerUser возвращает профиль пользователя Remnawave для customer бота/кабинета.
// Для web-only и synthetic telegram_id использует FindUserForAdminCustomer (subscription_link, префикс customer_id).
func ResolveRemnawaveCustomerUser(ctx context.Context, rw *remnawave.Client, c *database.Customer) (*remnawave.User, error) {
	if rw == nil || c == nil {
		return nil, errors.New("remnawave resolve: missing client or customer")
	}
	if needsWebOnlyRemnawaveSync(c) {
		return rw.FindUserForAdminCustomer(ctx, c.ID, c.TelegramID, c.SubscriptionLink, c.IsWebOnly)
	}
	return rw.GetUserTrafficInfo(ctx, c.TelegramID)
}

// HwidDeviceLimitFromUser — лимит HWID из карточки Remnawave; 0 если не задан.
func HwidDeviceLimitFromUser(u *remnawave.User) int {
	if u == nil || u.HwidDeviceLimit == nil {
		return 0
	}
	return *u.HwidDeviceLimit
}
