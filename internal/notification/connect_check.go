package notification

import (
	"context"
	"errors"

	"remnawave-tg-shop-bot/internal/remnawave"
)

// IsUserConnected проверяет, подключался ли пользователь к VPN через Remnawave.
// Connected = true если любое из: FirstConnectedAt != nil, UsedTrafficBytes > 0, len(devices) > 0.
// При ErrUserNotFound считаем «не подключён» (пользователя ещё нет в панели).
func IsUserConnected(ctx context.Context, rw *remnawave.Client, telegramID int64) (bool, error) {
	if rw == nil {
		return false, errors.New("remnawave client is nil")
	}

	user, err := rw.GetUserTrafficInfo(ctx, telegramID)
	if err != nil {
		if errors.Is(err, remnawave.ErrUserNotFound) {
			return false, nil
		}
		return false, err
	}

	if user == nil {
		return false, nil
	}

	// Проверка 1: FirstConnectedAt
	if user.UserTraffic.FirstConnectedAt != nil {
		return true, nil
	}

	// Проверка 2: UsedTrafficBytes
	if user.UserTraffic.UsedTrafficBytes > 0 {
		return true, nil
	}

	// Проверка 3: наличие устройств
	uuidStr := user.UUID.String()
	if uuidStr != "" && uuidStr != "00000000-0000-0000-0000-000000000000" {
		devices, err := rw.GetUserDevicesByUuid(ctx, uuidStr)
		if err == nil && len(devices) > 0 {
			return true, nil
		}
	}

	return false, nil
}
