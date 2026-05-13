package handler

import (
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/translation"
)

// SubscriptionExpiringRenewInlineButton — кнопка «Продлить подписку» в уведомлении об истечении срока (рассылка).
// При включённом кабинете и CABINET_TELEGRAM_UI_MODE=minimalism — WebApp на /cabinet/tariffs; иначе callback buy (оплата в боте).
func SubscriptionExpiringRenewInlineButton(lang string, tm *translation.Manager) models.InlineKeyboardButton {
	if cabinetTelegramMinimalismActive() {
		return tm.WithButton(lang, "renew_subscription_button", models.InlineKeyboardButton{
			WebApp: &models.WebAppInfo{URL: cabinetWebAppURL("/cabinet/tariffs")},
		})
	}
	return tm.WithButton(lang, "renew_subscription_button", models.InlineKeyboardButton{CallbackData: CallbackBuy})
}
