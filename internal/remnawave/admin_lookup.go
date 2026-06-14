package remnawave

import (
	"context"
	"errors"
	"strings"

	"remnawave-tg-shop-bot/utils"
)

// FindUserForAdminCustomer resolves a Remnawave user for cabinet admin operations.
// Avoids a full GetUsers scan when direct telegram / prefix lookup succeeds.
func (r *Client) FindUserForAdminCustomer(
	ctx context.Context,
	customerID int64,
	telegramID int64,
	subscriptionLink *string,
	isWebOnly bool,
) (*User, error) {
	if r == nil {
		return nil, errors.New("remnawave client not configured")
	}

	if !isWebOnly && !utils.IsSyntheticTelegramID(telegramID) {
		u, err := r.GetUserTrafficInfo(ctx, telegramID)
		if err == nil && u != nil {
			return u, nil
		}
		if err != nil && !errors.Is(err, ErrUserNotFound) {
			return nil, err
		}
	}

	u, err := r.findExistingUserForCustomer(ctx, customerID, telegramID)
	if err != nil {
		return nil, err
	}
	if u != nil {
		return u, nil
	}

	subLink := ""
	if subscriptionLink != nil {
		subLink = strings.TrimSpace(*subscriptionLink)
	}
	if subLink == "" {
		return nil, ErrUserNotFound
	}

	all, err := r.GetUsers(ctx)
	if err != nil {
		return nil, err
	}
	for i := range all {
		if strings.TrimSpace(all[i].SubscriptionUrl) == subLink {
			return &all[i], nil
		}
	}
	for i := range all {
		if all[i].TelegramID != nil && *all[i].TelegramID == telegramID {
			return &all[i], nil
		}
	}
	return nil, ErrUserNotFound
}
