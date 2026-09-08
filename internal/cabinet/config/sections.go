package config

import (
	"strings"

	botcfg "remnawave-tg-shop-bot/internal/config"
)

// SubscriptionLoyaltyVisible — CABINET_SUBSCRIPTION_SHOW_LOYALTY (runtime/env).
// По умолчанию false: плашка уровня лояльности на странице подписки скрыта,
// пока админ не включит её сам. Флаг управляет только страницей /subscription —
// раздел /loyalty и плашка в профиле от него не зависят, программу целиком
// выключает LOYALTY_ENABLED.
func SubscriptionLoyaltyVisible() bool {
	return strings.EqualFold(strings.TrimSpace(botcfg.EffectiveEnv("CABINET_SUBSCRIPTION_SHOW_LOYALTY")), "true")
}
