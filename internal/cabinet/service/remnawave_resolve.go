package service

import (
	"context"
	"errors"
	"log/slog"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

// remnawaveIdentityStore — часть CustomerRepository, нужная для ленивого backfill.
// Интерфейс, а не конкретный тип, чтобы резолв можно было тестировать без БД.
type remnawaveIdentityStore interface {
	SetRemnawaveIdentity(ctx context.Context, customerID int64, remnawaveUserID int64, shortUUID string) error
}

// ResolveRemnawaveCustomerUser возвращает профиль пользователя Remnawave для customer бота/кабинета.
//
// Единая точка резолва для всего проекта. Порядок:
//  1. быстрый путь — customer.remnawave_user_id → GET /api/users/{userId};
//  2. обычные TG-клиенты — поиск по telegram_id (в 3.x это /api/users/stream);
//  3. web-only и synthetic telegram_id — FindUserForAdminCustomer
//     (panel_username, префикс customer_id, subscription_link).
//
// После успешного резолва идентификатор панели лениво сохраняется в customer,
// чтобы следующий вызов пошёл коротким путём. store может быть nil — тогда
// backfill выключен, а резолв работает как раньше.
//
// Почему backfill ленивый, а не разовым скриптом: схема самовосстанавливается —
// неверная запись перезапишется следующим резолвом. См.
// .cursor/work-in-progress/remnawave-3x-migration/ раздел 4.
func ResolveRemnawaveCustomerUser(ctx context.Context, rw *remnawave.Client, store remnawaveIdentityStore, c *database.Customer) (*remnawave.User, error) {
	if rw == nil || c == nil {
		return nil, errors.New("remnawave resolve: missing client or customer")
	}

	if c.RemnawaveUserID != nil && *c.RemnawaveUserID > 0 {
		user, err := rw.GetUserByID(ctx, *c.RemnawaveUserID)
		if err == nil && user != nil {
			// Привязка — кеш, а не источник истины, поэтому она проверяется, а не
			// принимается на веру. Без проверки одна ошибочная запись становится
			// вечной: быстрый путь всегда успешен, поиск никогда не перезапишет
			// её, и клиент до конца жизни видел бы чужие устройства и подписку.
			// Сверяем только там, где есть с чем сверять: у web-only клиентов
			// telegram_id синтетический и в панель не попадает.
			if ownsPanelProfile(c, user) {
				return user, nil
			}
			slog.Warn("remnawave resolve: сохранённый id указывает на чужой профиль, ищем заново",
				"customer_id", c.ID, "remnawave_user_id", *c.RemnawaveUserID,
				"profile_telegram_id", user.TelegramID)
		}
		// Профиль удалён в панели или id протух — не считаем это фатальным
		// и падаем на общий путь поиска, который заодно перезапишет привязку.
		if err != nil && !errors.Is(err, remnawave.ErrNotFound) && !errors.Is(err, remnawave.ErrUserNotFound) {
			return nil, err
		}
		slog.Info("remnawave resolve: stale panel id, falling back to search",
			"customer_id", c.ID, "remnawave_user_id", *c.RemnawaveUserID)
	}

	var (
		user *remnawave.User
		err  error
	)
	if needsWebOnlyRemnawaveSync(c) {
		user, err = rw.FindUserForAdminCustomer(ctx, c.ID, c.TelegramID, c.SubscriptionLink, c.IsWebOnly)
	} else {
		user, err = rw.GetUserTrafficInfo(ctx, c.TelegramID)
	}
	if err != nil {
		return nil, err
	}

	rememberRemnawaveIdentity(ctx, store, c, user)
	return user, nil
}

// ownsPanelProfile проверяет, что профиль панели действительно принадлежит клиенту.
//
// Сверка идёт по telegram_id — единственному признаку, который есть у обеих сторон.
// Для web-only клиентов telegram_id синтетический и в панель не отправляется, поэтому
// у их профилей его нет: такие случаи проверить нечем, и мы доверяем сохранённой
// привязке (её и так писал резолв по username/subscription_link).
func ownsPanelProfile(c *database.Customer, user *remnawave.User) bool {
	if c == nil || user == nil {
		return false
	}
	if user.TelegramID == nil {
		return true
	}
	return *user.TelegramID == c.TelegramID
}

// rememberRemnawaveIdentity сохраняет id профиля панели у клиента.
// Ошибка записи логируется, но не возвращается: это кеш резолва, а не источник
// истины, и падать из-за него в оплате или выдаче подписки нельзя.
func rememberRemnawaveIdentity(ctx context.Context, store remnawaveIdentityStore, c *database.Customer, user *remnawave.User) {
	if store == nil || c == nil || user == nil || user.ID <= 0 {
		return
	}
	if c.RemnawaveUserID != nil && *c.RemnawaveUserID == user.ID {
		return
	}
	if err := store.SetRemnawaveIdentity(ctx, c.ID, user.ID, user.ShortUUID); err != nil {
		slog.Warn("remnawave resolve: failed to persist panel id (non-fatal)",
			"customer_id", c.ID, "remnawave_user_id", user.ID, "error", err)
		return
	}
	id := user.ID
	c.RemnawaveUserID = &id
	if user.ShortUUID != "" {
		short := user.ShortUUID
		c.RemnawaveShortUUID = &short
	}
}

// HwidDeviceLimitFromUser — лимит HWID из карточки Remnawave; 0 если не задан.
func HwidDeviceLimitFromUser(u *remnawave.User) int {
	if u == nil || u.HwidDeviceLimit == nil {
		return 0
	}
	return *u.HwidDeviceLimit
}
