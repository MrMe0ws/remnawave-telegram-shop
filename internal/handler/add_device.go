package handler

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/utils"
)

func (h Handler) AddDeviceCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.Message.Message == nil {
		return
	}

	callbackMessage := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode

	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("Error finding customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "telegramId", utils.MaskHalfInt64(update.CallbackQuery.From.ID))
		return
	}
	if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
		slog.Error("Error cleaning expired extra hwid", "error", err)
		return
	}
	if customer.ExpireAt == nil || customer.ExpireAt.Before(time.Now()) {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "no_subscription"), CallbackConnect)
		return
	}

	hasPaid, err := h.purchaseRepository.HasPaidSubscription(ctx, customer.ID)
	if err != nil {
		slog.Error("Error checking paid purchase", "error", err)
		return
	}
	if !hasPaid {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_add_paid_only"), CallbackConnect)
		return
	}

	userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("Error getting user info", "error", err)
		return
	}
	currentLimit := resolveCurrentDeviceLimit(userInfo)
	maxLimit := config.HwidMaxDevices()
	if maxLimit > 0 && currentLimit >= maxLimit {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_add_limit_reached"), CallbackConnect)
		return
	}

	h.showDeviceChangeOptions(ctx, b, callbackMessage, langCode, customer, currentLimit, maxLimit)
}

func (h Handler) AddDeviceConfirmCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.Message.Message == nil {
		return
	}
	callbackMessage := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode
	params := parseCallbackData(update.CallbackQuery.Data)
	target, err := strconv.Atoi(params["target"])
	if err != nil || target <= 0 {
		return
	}

	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("Error finding customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "telegramId", utils.MaskHalfInt64(update.CallbackQuery.From.ID))
		return
	}
	if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
		slog.Error("Error cleaning expired extra hwid", "error", err)
		return
	}
	if customer.ExpireAt == nil || customer.ExpireAt.Before(time.Now()) {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "no_subscription"), CallbackConnect)
		return
	}

	hasPaid, err := h.purchaseRepository.HasPaidSubscription(ctx, customer.ID)
	if err != nil {
		slog.Error("Error checking paid purchase", "error", err)
		return
	}
	if !hasPaid {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_add_paid_only"), CallbackConnect)
		return
	}

	userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("Error getting user info", "error", err)
		return
	}
	currentLimit := resolveCurrentDeviceLimit(userInfo)
	maxLimit := config.HwidMaxDevices()
	if maxLimit > 0 && target > maxLimit {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_add_limit_reached"), CallbackManageDevices)
		return
	}

	h.showDeviceChangeConfirm(ctx, b, callbackMessage, langCode, customer, currentLimit, target)
}

func (h Handler) AddDeviceApplyCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.Message.Message == nil {
		return
	}
	callbackMessage := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode
	params := parseCallbackData(update.CallbackQuery.Data)
	target, err := strconv.Atoi(params["target"])
	if err != nil || target <= 0 {
		return
	}

	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("Error finding customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "telegramId", utils.MaskHalfInt64(update.CallbackQuery.From.ID))
		return
	}
	if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
		slog.Error("Error cleaning expired extra hwid", "error", err)
		return
	}
	if customer.ExpireAt == nil || customer.ExpireAt.Before(time.Now()) {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "no_subscription"), CallbackConnect)
		return
	}

	userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("Error getting user info", "error", err)
		return
	}
	currentLimit := resolveCurrentDeviceLimit(userInfo)
	if target == currentLimit {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_change_noop"), CallbackConnect)
		return
	}

	baseLimit := currentLimit - activeExtraDevices(customer)
	if baseLimit < 1 {
		baseLimit = 1
	}
	newExtra := target - baseLimit
	if newExtra < 0 {
		newExtra = 0
	}

	if _, err := h.syncService.GetRemnawaveClient().UpdateUserDeviceLimit(ctx, customer.TelegramID, target); err != nil {
		slog.Error("Error updating hwid limit", "error", err)
		return
	}

	updates := map[string]interface{}{
		"extra_hwid":            newExtra,
		"extra_hwid_expires_at": nil,
	}
	if newExtra > 0 {
		updates["extra_hwid_expires_at"] = customer.ExpireAt
	}
	if err := h.customerRepository.UpdateFields(ctx, customer.ID, updates); err != nil {
		slog.Error("Error updating extra hwid", "error", err)
		return
	}

	text := fmt.Sprintf(h.translation.GetText(langCode, "hwid_change_success_free"), currentLimit, target)
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: [][]models.InlineKeyboardButton{
				{
					h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackConnect}),
				},
			},
		},
	})
	if err != nil {
		slog.Error("Error sending apply device message", "error", err)
	}
}

func (h Handler) AddDevicePaymentCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.Message.Message == nil {
		return
	}

	callbackMessage := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode
	params := parseCallbackData(update.CallbackQuery.Data)
	target, err := strconv.Atoi(params["target"])
	if err != nil || target <= 0 {
		return
	}

	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("Error finding customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "telegramId", utils.MaskHalfInt64(update.CallbackQuery.From.ID))
		return
	}
	if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
		slog.Error("Error cleaning expired extra hwid", "error", err)
		return
	}
	if customer.ExpireAt == nil || customer.ExpireAt.Before(time.Now()) {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "no_subscription"), CallbackConnect)
		return
	}

	userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("Error getting user info", "error", err)
		return
	}
	currentLimit := resolveCurrentDeviceLimit(userInfo)
	if target <= currentLimit {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_change_noop"), CallbackConnect)
		return
	}

	delta := target - currentLimit
	daysLeft := remainingDays(customer.ExpireAt)
	if daysLeft <= 0 {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "no_subscription"), CallbackConnect)
		return
	}
	pricePerMonth := config.HwidAddPrice()
	if params["invoiceType"] == string(database.InvoiceTypeTelegram) {
		pricePerMonth = config.HwidAddStarsPrice()
	}
	amount := calcProportionalPrice(pricePerMonth, delta, daysLeft)

	if params["invoiceType"] == "" {
		h.showDevicePaymentMethods(ctx, b, callbackMessage, langCode, target, amount)
		return
	}

	invoiceType := database.InvoiceType(params["invoiceType"])
	ctxWithUsername := context.WithValue(ctx, remnawave.CtxKeyUsername, update.CallbackQuery.From.Username)
	paymentURL, purchaseId, err := h.paymentService.CreateHwidPurchase(ctxWithUsername, float64(amount), delta, customer, invoiceType)
	if err != nil {
		slog.Error("Error creating hwid payment", "error", err)
		return
	}

	text := fmt.Sprintf(h.translation.GetText(langCode, "hwid_payment_title"), delta, formatPaymentAmount(amount, params["invoiceType"]), daysLeft)
	message, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: [][]models.InlineKeyboardButton{
				{
					h.translation.WithButton(langCode, "pay_button", models.InlineKeyboardButton{URL: paymentURL}),
					h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d", CallbackAddDevicePayment, target)}),
				},
			},
		},
	})
	if err != nil {
		slog.Error("Error sending hwid payment message", "error", err)
		return
	}

	if purchaseId > 0 {
		h.cache.Set(purchaseId, message.ID)
	}
}

func (h Handler) showDeviceChangeOptions(ctx context.Context, b *bot.Bot, callbackMessage *models.Message, langCode string, customer *database.Customer, currentLimit, maxLimit int) {
	if maxLimit <= 0 {
		maxLimit = currentLimit
	}
	if maxLimit < currentLimit {
		maxLimit = currentLimit
	}
	text := buildDeviceChangeText(langCode, currentLimit, config.HwidAddPrice())
	keyboard := buildDeviceChangeOptionsKeyboard(langCode, currentLimit, maxLimit, remainingDays(customer.ExpireAt), config.HwidAddPrice())
	keyboard = append(keyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackManageDevices}),
	})

	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: keyboard,
		},
	})
	logEditError("Error sending add device message", err)
}

func (h Handler) showDeviceChangeConfirm(ctx context.Context, b *bot.Bot, callbackMessage *models.Message, langCode string, customer *database.Customer, currentLimit, target int) {
	if target == currentLimit {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_change_noop"), CallbackManageDevices)
		return
	}

	daysLeft := remainingDays(customer.ExpireAt)
	delta := target - currentLimit
	amount := 0
	pricePerMonth := config.HwidAddPrice()
	actionKey := "hwid_change_action_decrease"
	if delta > 0 {
		amount = calcProportionalPrice(pricePerMonth, delta, daysLeft)
		actionKey = "hwid_change_action_increase"
	}

	actionText := fmt.Sprintf(h.translation.GetText(langCode, actionKey), target)
	amountText := h.translation.GetText(langCode, "hwid_change_no_refund")
	if delta > 0 {
		amountText = fmt.Sprintf(h.translation.GetText(langCode, "hwid_change_amount"), amount, daysLeft)
	}

	text := fmt.Sprintf(h.translation.GetText(langCode, "hwid_change_confirm_text"), currentLimit, target, actionText, amountText)
	var keyboard [][]models.InlineKeyboardButton
	if delta > 0 {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "confirm_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d", CallbackAddDevicePayment, target)}),
		})
	} else {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "confirm_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d", CallbackAddDeviceApply, target)}),
		})
	}
	keyboard = append(keyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "cancel_button", models.InlineKeyboardButton{CallbackData: CallbackAddDevice}),
	})

	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: keyboard,
		},
	})
	logEditError("Error sending confirm device message", err)
}

func (h Handler) showDevicePaymentMethods(ctx context.Context, b *bot.Bot, callbackMessage *models.Message, langCode string, target, amount int) {
	var keyboard [][]models.InlineKeyboardButton

	if config.IsCryptoPayEnabled() {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "crypto_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d&invoiceType=%s", CallbackAddDevicePayment, target, database.InvoiceTypeCrypto)}),
		})
	}

	if config.IsYookasaEnabled() {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "card_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d&invoiceType=%s", CallbackAddDevicePayment, target, database.InvoiceTypeYookasa)}),
		})
	}

	if config.IsTelegramStarsEnabled() {
		shouldShowStarsButton := true
		if config.RequirePaidPurchaseForStars() {
			customer, err := h.customerRepository.FindByTelegramId(ctx, callbackMessage.Chat.ID)
			if err != nil {
				slog.Error("Error finding customer for stars check", "error", err)
				shouldShowStarsButton = false
			} else if customer != nil {
				hasPaid, err := h.purchaseRepository.HasPaidSubscription(ctx, customer.ID)
				if err != nil {
					slog.Error("Error checking paid purchase", "error", err)
					shouldShowStarsButton = false
				} else if !hasPaid {
					shouldShowStarsButton = false
				}
			} else {
				shouldShowStarsButton = false
			}
		}
		if shouldShowStarsButton {
			keyboard = append(keyboard, []models.InlineKeyboardButton{
				h.translation.WithButton(langCode, "stars_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d&invoiceType=%s", CallbackAddDevicePayment, target, database.InvoiceTypeTelegram)}),
			})
		}
	}

	if config.GetTributeWebHookUrl() != "" {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "tribute_button", models.InlineKeyboardButton{URL: config.GetTributePaymentUrl()}),
		})
	}

	keyboard = append(keyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?target=%d", CallbackAddDeviceConfirm, target)}),
	})

	text := fmt.Sprintf(h.translation.GetText(langCode, "hwid_payment_methods"), amount)
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: keyboard,
		},
	})
	logEditError("Error sending add device payment options", err)
}

func buildDeviceChangeText(langCode string, currentLimit, price int) string {
	tm := translation.GetInstance()
	return fmt.Sprintf(tm.GetText(langCode, "hwid_change_title"), currentLimit, price)
}

func buildDeviceChangeOptionsKeyboard(langCode string, currentLimit, maxLimit, daysLeft, price int) [][]models.InlineKeyboardButton {
	var keyboard [][]models.InlineKeyboardButton
	var row []models.InlineKeyboardButton
	tm := translation.GetInstance()

	for count := 1; count <= maxLimit; count++ {
		label := ""
		if count < currentLimit {
			label = fmt.Sprintf(tm.GetText(langCode, "hwid_change_option_decrease"), count)
		} else if count == currentLimit {
			label = fmt.Sprintf(tm.GetText(langCode, "hwid_change_option_current"), count)
		} else {
			amount := calcProportionalPrice(price, count-currentLimit, daysLeft)
			label = fmt.Sprintf(tm.GetText(langCode, "hwid_change_option_increase"), count, amount, daysLeft)
		}
		row = append(row, models.InlineKeyboardButton{
			Text:         label,
			CallbackData: fmt.Sprintf("%s?target=%d", CallbackAddDeviceConfirm, count),
		})
		if len(row) == 2 {
			keyboard = append(keyboard, row)
			row = nil
		}
	}
	if len(row) > 0 {
		keyboard = append(keyboard, row)
	}
	return keyboard
}

func remainingDays(expireAt *time.Time) int {
	if expireAt == nil {
		return 0
	}
	diff := time.Until(*expireAt)
	if diff <= 0 {
		return 0
	}
	return int(math.Ceil(diff.Hours() / 24))
}

func calcProportionalPrice(pricePerMonth, delta, daysLeft int) int {
	if delta <= 0 || pricePerMonth <= 0 || daysLeft <= 0 {
		return 0
	}
	total := float64(pricePerMonth*delta) * float64(daysLeft) / 30.0
	return int(math.Ceil(total))
}

func formatPaymentAmount(amount int, invoiceType string) string {
	if invoiceType == string(database.InvoiceTypeTelegram) {
		return fmt.Sprintf("%d STARS", amount)
	}
	return fmt.Sprintf("%d ₽", amount)
}

func resolveCurrentDeviceLimit(userInfo *remnawave.User) int {
	if userInfo == nil {
		return 0
	}
	if userInfo.HwidDeviceLimit != nil && *userInfo.HwidDeviceLimit > 0 {
		return *userInfo.HwidDeviceLimit
	}
	return config.GetHwidFallbackDeviceLimit()
}

func activeExtraDevices(customer *database.Customer) int {
	if customer == nil || customer.ExtraHwid <= 0 || customer.ExtraHwidExpiresAt == nil {
		return 0
	}
	if customer.ExtraHwidExpiresAt.After(time.Now()) {
		return customer.ExtraHwid
	}
	return 0
}

func (h Handler) cleanupExpiredExtraHwid(ctx context.Context, customer *database.Customer) error {
	if customer == nil || customer.ExtraHwid <= 0 || customer.ExtraHwidExpiresAt == nil {
		return nil
	}
	if customer.ExtraHwidExpiresAt.After(time.Now()) {
		return nil
	}

	userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		return err
	}
	totalLimit := resolveCurrentDeviceLimit(userInfo)
	if totalLimit <= 0 {
		totalLimit = config.GetHwidFallbackDeviceLimit()
	}
	newLimit := totalLimit - customer.ExtraHwid
	if newLimit < 1 {
		newLimit = 1
	}
	_, err = h.syncService.GetRemnawaveClient().UpdateUserDeviceLimit(ctx, customer.TelegramID, newLimit)
	if err != nil {
		return err
	}

	return h.customerRepository.UpdateFields(ctx, customer.ID, map[string]interface{}{
		"extra_hwid":            0,
		"extra_hwid_expires_at": nil,
	})
}

func (h Handler) editSimpleMessage(ctx context.Context, b *bot.Bot, message *models.Message, langCode, text string, backCallback string) {
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    message.Chat.ID,
		MessageID: message.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: [][]models.InlineKeyboardButton{
				{
					h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: backCallback}),
				},
			},
		},
	})
	logEditError("Error editing message", err)
}
