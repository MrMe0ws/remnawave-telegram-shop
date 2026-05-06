package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

// HwidExtraLimits — снимок лимитов устройств для UI и расчёта доплаты (как в Telegram add_device).
type HwidExtraLimits struct {
	CurrentLimit int
	BaseLimit    int
	MaxCap       int // HwidMaxDevices; 0 = нет жёсткого потолка env
	ActiveExtra  int
	DaysLeft     int
}

// ActiveExtraSlots — число оплаченных доп. слотов, ещё не истекших по extra_hwid_expires_at.
func ActiveExtraSlots(c *database.Customer) int {
	if c == nil || c.ExtraHwid <= 0 || c.ExtraHwidExpiresAt == nil {
		return 0
	}
	if c.ExtraHwidExpiresAt.After(time.Now()) {
		return c.ExtraHwid
	}
	return 0
}

func remainingSubscriptionDays(expireAt *time.Time) int {
	if expireAt == nil {
		return 0
	}
	diff := time.Until(*expireAt)
	if diff <= 0 {
		return 0
	}
	return int(math.Ceil(diff.Hours() / 24))
}

// CurrentDeviceLimitFromRW — лимит из ответа панели или fallback из env.
func CurrentDeviceLimitFromRW(userInfo *remnawave.User) int {
	if userInfo == nil {
		return 0
	}
	if userInfo.HwidDeviceLimit != nil && *userInfo.HwidDeviceLimit > 0 {
		return *userInfo.HwidDeviceLimit
	}
	return config.GetHwidFallbackDeviceLimit()
}

// CalcHwidProportionalRub — пропорциональная доплата за +delta устройств до конца подписки.
func CalcHwidProportionalRub(pricePerMonth, delta, daysLeft int) int {
	if delta <= 0 || pricePerMonth <= 0 || daysLeft <= 0 {
		return 0
	}
	total := float64(pricePerMonth*delta) * float64(daysLeft) / 30.0
	return int(math.Ceil(total))
}

// CleanupExpiredExtraHwid — если extra_hwid протух, сбрасывает лимит в панели и в БД (как handler.cleanupExpiredExtraHwid).
func CleanupExpiredExtraHwid(ctx context.Context, rw *remnawave.Client, customers *database.CustomerRepository, c *database.Customer) error {
	if rw == nil || customers == nil || c == nil {
		return nil
	}
	if c.ExtraHwid <= 0 || c.ExtraHwidExpiresAt == nil {
		return nil
	}
	if c.ExtraHwidExpiresAt.After(time.Now()) {
		return nil
	}
	newLimit := config.GetHwidFallbackDeviceLimit()
	if newLimit < 1 {
		newLimit = 1
	}
	if _, err := rw.UpdateUserDeviceLimit(ctx, c.TelegramID, newLimit); err != nil {
		return fmt.Errorf("hwid cleanup: update panel: %w", err)
	}
	if err := customers.UpdateFields(ctx, c.ID, map[string]interface{}{
		"extra_hwid":            0,
		"extra_hwid_expires_at": nil,
	}); err != nil {
		return fmt.Errorf("hwid cleanup: db: %w", err)
	}
	c.ExtraHwid = 0
	c.ExtraHwidExpiresAt = nil
	return nil
}

// BuildHwidExtraLimits собирает лимиты после опциональной очистки протухшего extra (caller передаёт уже загруженного customer и rw user).
func BuildHwidExtraLimits(customer *database.Customer, rwUser *remnawave.User) HwidExtraLimits {
	cur := CurrentDeviceLimitFromRW(rwUser)
	extra := ActiveExtraSlots(customer)
	base := cur - extra
	if base < 1 {
		base = 1
	}
	return HwidExtraLimits{
		CurrentLimit: cur,
		BaseLimit:    base,
		MaxCap:       config.HwidMaxDevices(),
		ActiveExtra:  extra,
		DaysLeft:     remainingSubscriptionDays(customer.ExpireAt),
	}
}
