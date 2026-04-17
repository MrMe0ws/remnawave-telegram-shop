package handler

import (
	"context"
	"fmt"
	"strconv"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

func (h Handler) RenewExtraHwidCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.Message.Message == nil {
		return
	}
	callbackMessage := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode
	params := parseCallbackData(update.CallbackQuery.Data)

	extra, err := strconv.Atoi(params["extra"])
	if err != nil || extra <= 0 {
		return
	}
	months, err := strconv.Atoi(params["months"])
	if err != nil || months <= 0 {
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
	if !config.HwidExtraDevicesEnabled() {
		h.editSimpleMessage(ctx, b, callbackMessage, langCode, h.translation.GetText(langCode, "hwid_extra_disabled"), CallbackConnect)
		return
	}

	amount := config.HwidAddPrice() * extra * months
	if params["invoiceType"] == string(database.InvoiceTypeTelegram) {
		amount = config.HwidAddStarsPrice() * extra * months
	}
	if params["invoiceType"] == "" {
		h.showRenewPaymentMethods(ctx, b, callbackMessage, langCode, extra, months, amount)
		return
	}

	invoiceType := database.InvoiceType(params["invoiceType"])
	amt := amount
	meta := h.checkoutPromoMeta(ctx, customer, invoiceType, &amt)
	ctxWithUsername := context.WithValue(ctx, remnawave.CtxKeyUsername, update.CallbackQuery.From.Username)
	paymentURL, purchaseId, err := h.paymentService.CreateHwidPurchase(ctxWithUsername, float64(amt), extra, customer, invoiceType, meta)
	if err != nil {
		slog.Error("Error creating renew hwid payment", "error", err)
		return
	}

	text := fmt.Sprintf(h.translation.GetText(langCode, "hwid_renew_payment_title"), extra, months, amt)
	message, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: [][]models.InlineKeyboardButton{
				{
					h.translation.WithButton(langCode, "pay_button", models.InlineKeyboardButton{URL: paymentURL}),
					h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?extra=%d&months=%d", CallbackRenewExtraHwid, extra, months)}),
				},
			},
		},
	})
	if err != nil {
		logEditError("Error sending renew hwid payment message", err)
		return
	}

	if purchaseId > 0 {
		h.cache.Set(purchaseId, message.ID)
	}
}

func (h Handler) showRenewPaymentMethods(ctx context.Context, b *bot.Bot, callbackMessage *models.Message, langCode string, extra, months, amount int) {
	var keyboard [][]models.InlineKeyboardButton

	if config.IsCryptoPayEnabled() {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "crypto_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?extra=%d&months=%d&invoiceType=%s", CallbackRenewExtraHwid, extra, months, database.InvoiceTypeCrypto)}),
		})
	}

	if config.IsYookasaEnabled() {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "card_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?extra=%d&months=%d&invoiceType=%s", CallbackRenewExtraHwid, extra, months, database.InvoiceTypeYookasa)}),
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
				h.translation.WithButton(langCode, "stars_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?extra=%d&months=%d&invoiceType=%s", CallbackRenewExtraHwid, extra, months, database.InvoiceTypeTelegram)}),
			})
		}
	}

	if config.GetTributeWebHookUrl() != "" {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "tribute_button", models.InlineKeyboardButton{URL: config.GetTributePaymentUrl()}),
		})
	}

	keyboard = append(keyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackConnect}),
	})

	text := fmt.Sprintf(h.translation.GetText(langCode, "hwid_renew_payment_methods"), amount)
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: keyboard,
		},
	})
	logEditError("Error sending renew hwid payment methods", err)
}
