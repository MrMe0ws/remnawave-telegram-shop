package handler

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
)

func (h Handler) BuyCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	callback := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode

	var priceButtons []models.InlineKeyboardButton

	if config.Price1() > 0 {
		priceButtons = append(priceButtons, h.translation.WithButton(langCode, "month_1", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?month=%d&amount=%d", CallbackSell, 1, config.Price1()),
		}))
	}

	if config.Price3() > 0 {
		priceButtons = append(priceButtons, h.translation.WithButton(langCode, "month_3", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?month=%d&amount=%d", CallbackSell, 3, config.Price3()),
		}))
	}

	if config.Price6() > 0 {
		priceButtons = append(priceButtons, h.translation.WithButton(langCode, "month_6", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?month=%d&amount=%d", CallbackSell, 6, config.Price6()),
		}))
	}

	if config.Price12() > 0 {
		priceButtons = append(priceButtons, h.translation.WithButton(langCode, "month_12", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?month=%d&amount=%d", CallbackSell, 12, config.Price12()),
		}))
	}

	keyboard := [][]models.InlineKeyboardButton{}

	if len(priceButtons) == 4 {
		keyboard = append(keyboard, priceButtons[:2])
		keyboard = append(keyboard, priceButtons[2:])
	} else if len(priceButtons) > 0 {
		keyboard = append(keyboard, priceButtons)
	}

	keyboard = append(keyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackStart}),
	})

	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callback.Chat.ID,
		MessageID: callback.ID,
		ParseMode: models.ParseModeHTML,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: keyboard,
		},
		Text: h.translation.GetText(langCode, "pricing_info"),
	})
	logEditError("Error sending buy message", err)
}

func (h Handler) SellCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	callback := update.CallbackQuery.Message.Message
	callbackQuery := parseCallbackData(update.CallbackQuery.Data)
	langCode := update.CallbackQuery.From.LanguageCode
	month := callbackQuery["month"]
	amount := callbackQuery["amount"]
	extraChoice := callbackQuery["extra"]

	var keyboard [][]models.InlineKeyboardButton

	if extraChoice == "" {
		customer, err := h.customerRepository.FindByTelegramId(ctx, callback.Chat.ID)
		if err != nil {
			slog.Error("Error finding customer", err)
			return
		}
		if customer == nil {
			slog.Error("customer not exist", "chatID", callback.Chat.ID, "error", err)
			return
		}
		if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
			slog.Error("Error cleaning expired extra hwid", "error", err)
			return
		}
		if customer.ExtraHwid > 0 && customer.ExtraHwidExpiresAt != nil && customer.ExtraHwidExpiresAt.After(time.Now()) {
			monthInt := parseIntSafe(month)
			promptText := fmt.Sprintf(h.translation.GetText(langCode, "hwid_renew_prompt"), customer.ExtraHwid, monthInt, config.HwidAddPrice()*customer.ExtraHwid*monthInt)
			_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
				ChatID:    callback.Chat.ID,
				MessageID: callback.ID,
				ParseMode: models.ParseModeHTML,
				Text:      promptText,
				ReplyMarkup: models.InlineKeyboardMarkup{
					InlineKeyboard: [][]models.InlineKeyboardButton{
						{
							h.translation.WithButton(langCode, "hwid_renew_confirm_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?month=%s&amount=%s&extra=%d", CallbackSell, month, amount, customer.ExtraHwid)}),
						},
						{
							h.translation.WithButton(langCode, "hwid_renew_cancel_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?month=%s&amount=%s&extra=%d", CallbackSell, month, amount, 0)}),
						},
					},
				},
			})
			logEditError("Error sending renew prompt", err)
			return
		}
	}

	extraCount := 0
	if extraChoice != "" {
		extraCount = parseIntSafe(extraChoice)
	}

	if config.IsCryptoPayEnabled() {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "crypto_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?month=%s&invoiceType=%s&amount=%s&extra=%d", CallbackPayment, month, database.InvoiceTypeCrypto, amount, extraCount)}),
		})
	}

	if config.IsYookasaEnabled() {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "card_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?month=%s&invoiceType=%s&amount=%s&extra=%d", CallbackPayment, month, database.InvoiceTypeYookasa, amount, extraCount)}),
		})
	}

	if config.IsTelegramStarsEnabled() {
		shouldShowStarsButton := true

		if config.RequirePaidPurchaseForStars() {
			customer, err := h.customerRepository.FindByTelegramId(ctx, callback.Chat.ID)
			if err != nil {
				slog.Error("Error finding customer for stars check", err)
				shouldShowStarsButton = false
			} else if customer != nil {
				paidPurchase, err := h.purchaseRepository.FindSuccessfulPaidPurchaseByCustomer(ctx, customer.ID)
				if err != nil {
					slog.Error("Error checking paid purchase", err)
					shouldShowStarsButton = false
				} else if paidPurchase == nil {
					shouldShowStarsButton = false
				}
			} else {
				shouldShowStarsButton = false
			}
		}

		if shouldShowStarsButton {
			keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "stars_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?month=%s&invoiceType=%s&amount=%s&extra=%d", CallbackPayment, month, database.InvoiceTypeTelegram, amount, extraCount)}),
			})
		}
	}

	if config.GetTributeWebHookUrl() != "" {
		keyboard = append(keyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "tribute_button", models.InlineKeyboardButton{URL: config.GetTributePaymentUrl()}),
		})
	}

	keyboard = append(keyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackBuy}),
	})

	textKey := "pricing_info"
	if extraCount > 0 {
		textKey = "pricing_info_extra"
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callback.Chat.ID,
		MessageID: callback.ID,
		ParseMode: models.ParseModeHTML,
		Text:      h.translation.GetText(langCode, textKey),
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: keyboard,
		},
	})
	logEditError("Error sending sell message", err)
}

func (h Handler) PaymentCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	callback := update.CallbackQuery.Message.Message
	callbackQuery := parseCallbackData(update.CallbackQuery.Data)
	month, err := strconv.Atoi(callbackQuery["month"])
	if err != nil {
		slog.Error("Error getting month from query", err)
		return
	}

	invoiceType := database.InvoiceType(callbackQuery["invoiceType"])
	extra := parseIntSafe(callbackQuery["extra"])

	var price int
	if invoiceType == database.InvoiceTypeTelegram {
		price = config.StarsPrice(month)
		if extra > 0 {
			price += config.HwidAddStarsPrice() * extra * month
		}
	} else {
		price = config.Price(month)
		if extra > 0 {
			price += config.HwidAddPrice() * extra * month
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()
	customer, err := h.customerRepository.FindByTelegramId(ctx, callback.Chat.ID)
	if err != nil {
		slog.Error("Error finding customer", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "chatID", callback.Chat.ID, "error", err)
		return
	}

	ctxWithUsername := context.WithValue(ctx, remnawave.CtxKeyUsername, update.CallbackQuery.From.Username)
	var paymentURL string
	var purchaseId int64
	if extra > 0 {
		paymentURL, purchaseId, err = h.paymentService.CreatePurchaseWithExtra(ctxWithUsername, float64(price), month, extra, customer, invoiceType)
	} else {
		paymentURL, purchaseId, err = h.paymentService.CreatePurchase(ctxWithUsername, float64(price), month, customer, invoiceType)
	}
	if err != nil {
		slog.Error("Error creating payment", err)
		return
	}

	langCode := update.CallbackQuery.From.LanguageCode

	message, err := b.EditMessageReplyMarkup(ctx, &bot.EditMessageReplyMarkupParams{
		ChatID:    callback.Chat.ID,
		MessageID: callback.ID,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: [][]models.InlineKeyboardButton{
				{
					h.translation.WithButton(langCode, "pay_button", models.InlineKeyboardButton{URL: paymentURL}),
					h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?month=%d&amount=%d&extra=%d", CallbackSell, month, price, extra)}),
				},
			},
		},
	})
	if err != nil {
		logEditError("Error updating sell message", err)
		return
	}
	h.cache.Set(purchaseId, message.ID)
}

func (h Handler) PreCheckoutCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	_, err := b.AnswerPreCheckoutQuery(ctx, &bot.AnswerPreCheckoutQueryParams{
		PreCheckoutQueryID: update.PreCheckoutQuery.ID,
		OK:                 true,
	})
	if err != nil {
		slog.Error("Error sending answer pre checkout query", err)
	}
}

func (h Handler) SuccessPaymentHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	payload := strings.Split(update.Message.SuccessfulPayment.InvoicePayload, "&")
	purchaseId, err := strconv.Atoi(payload[0])
	username := payload[1]
	if err != nil {
		slog.Error("Error parsing purchase id", err)
		return
	}

	ctxWithUsername := context.WithValue(ctx, remnawave.CtxKeyUsername, username)
	err = h.paymentService.ProcessPurchaseById(ctxWithUsername, int64(purchaseId))
	if err != nil {
		slog.Error("Error processing purchase", err)
	}
}

func parseIntSafe(value string) int {
	if value == "" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}

func parseCallbackData(data string) map[string]string {
	result := make(map[string]string)

	parts := strings.Split(data, "?")
	if len(parts) < 2 {
		return result
	}

	params := strings.Split(parts[1], "&")
	for _, param := range params {
		kv := strings.SplitN(param, "=", 2)
		if len(kv) == 2 {
			result[kv[0]] = kv[1]
		}
	}

	return result
}
