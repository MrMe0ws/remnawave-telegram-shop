package handler

import (
	"context"
	"strconv"
	"strings"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

func (h Handler) StartCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	adminID := config.GetAdminTelegramId()
	if update.Message != nil && update.Message.From.ID != adminID {
		h.ForwardUserMessageToAdmin(ctx, b, update)
	}
	ctxWithTime, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	langCode := update.Message.From.LanguageCode
	existingCustomer, err := h.customerRepository.FindByTelegramId(ctx, update.Message.Chat.ID)
	if err != nil {
		slog.Error("error finding customer by telegram id", err)
		return
	}

	if existingCustomer == nil {
		existingCustomer, err = h.customerRepository.Create(ctxWithTime, &database.Customer{
			TelegramID: update.Message.Chat.ID,
			Language:   langCode,
		})
		if err != nil {
			slog.Error("error creating customer", err)
			return
		}

		if strings.Contains(update.Message.Text, "ref_") {
			arg := strings.Split(update.Message.Text, " ")[1]
			if strings.HasPrefix(arg, "ref_") {
				code := strings.TrimPrefix(arg, "ref_")
				referrerId, err := strconv.ParseInt(code, 10, 64)
				if err != nil {
					slog.Error("error parsing referrer id", err)
					return
				}
				_, err = h.customerRepository.FindByTelegramId(ctx, referrerId)
				if err == nil {
					_, err := h.referralRepository.Create(ctx, referrerId, existingCustomer.TelegramID)
					if err != nil {
						slog.Error("error creating referral", err)
						return
					}
					slog.Info("referral created", "referrerId", utils.MaskHalfInt64(referrerId), "refereeId", utils.MaskHalfInt64(existingCustomer.TelegramID))
				}
			}
		}
	} else {
		updates := map[string]interface{}{
			"language": langCode,
		}

		err = h.customerRepository.UpdateFields(ctx, existingCustomer.ID, updates)
		if err != nil {
			slog.Error("Error updating customer", err)
			return
		}
	}

	inlineKeyboard := h.buildStartKeyboard(existingCustomer, langCode)

	m, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text:   "🧹",
		ReplyMarkup: models.ReplyKeyboardRemove{
			RemoveKeyboard: true,
		},
	})

	if err != nil {
		slog.Error("Error sending removing reply keyboard", err)
		return
	}

	_, err = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    update.Message.Chat.ID,
		MessageID: m.ID,
	})

	if err != nil {
		slog.Error("Error deleting message", err)
		return
	}

	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    update.Message.Chat.ID,
		ParseMode: models.ParseModeHTML,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: inlineKeyboard,
		},
		Text: h.translation.GetText(langCode, "greeting"),
	})
	if err != nil {
		slog.Error("Error sending /start message", err)
	}
}

func (h Handler) StartCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	ctxWithTime, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	callback := update.CallbackQuery
	langCode := callback.From.LanguageCode

	existingCustomer, err := h.customerRepository.FindByTelegramId(ctxWithTime, callback.From.ID)
	if err != nil {
		slog.Error("error finding customer by telegram id", err)
		return
	}

	inlineKeyboard := h.buildStartKeyboard(existingCustomer, langCode)

	_, err = b.EditMessageText(ctxWithTime, &bot.EditMessageTextParams{
		ChatID:    callback.Message.Message.Chat.ID,
		MessageID: callback.Message.Message.ID,
		ParseMode: models.ParseModeHTML,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: inlineKeyboard,
		},
		Text: h.translation.GetText(langCode, "greeting"),
	})
	if err != nil {
		slog.Error("Error sending /start message", err)
	}
}

func (h Handler) HelpCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	callback := update.CallbackQuery

	if callback == nil || callback.Message.Message == nil {
		slog.Error("HelpCallbackHandler: callback.Message.Message is nil")
		return
	}

	helpKeyboard := [][]models.InlineKeyboardButton{
		{{Text: "🌏 Какой сервер выбрать", URL: "https://telegra.ph/Otlichie--i--serverov-07-06"}},
		{
			{Text: "🆘 Поддержка", URL: "https://t.me/Meows_support_bot"},
			{Text: "📄 Публичная оферта", URL: "https://telegra.ph/Publichnaya-oferta-na-ispolzovanie-servisa-Meows-VPN-07-02"},
		},
		{{Text: "⬅️ Назад", CallbackData: CallbackStart}},
	}

	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callback.Message.Message.Chat.ID,
		MessageID: callback.Message.Message.ID,
		ParseMode: models.ParseModeHTML,
		Text:      "Помощь",
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: helpKeyboard,
		},
	})
	if err != nil {
		slog.Error("Error sending help message", err)
	}
}

func (h Handler) resolveConnectButton(lang string) []models.InlineKeyboardButton {
	var inlineKeyboard []models.InlineKeyboardButton

	if config.GetMiniAppURL() != "" {
		inlineKeyboard = []models.InlineKeyboardButton{
			{Text: h.translation.GetText(lang, "connect_button"), WebApp: &models.WebAppInfo{
				URL: config.GetMiniAppURL(),
			}},
		}
	} else {
		inlineKeyboard = []models.InlineKeyboardButton{
			{Text: h.translation.GetText(lang, "connect_button"), CallbackData: CallbackConnect},
		}
	}
	return inlineKeyboard
}

func (h Handler) buildStartKeyboard(existingCustomer *database.Customer, langCode string) [][]models.InlineKeyboardButton {
	var inlineKeyboard [][]models.InlineKeyboardButton

	if existingCustomer.SubscriptionLink == nil && config.TrialDays() > 0 {
		inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "trial_button"), CallbackData: CallbackTrial}})
	}

	inlineKeyboard = append(inlineKeyboard, [][]models.InlineKeyboardButton{{{Text: h.translation.GetText(langCode, "buy_button"), CallbackData: CallbackBuy}}}...)

	if existingCustomer.SubscriptionLink != nil && existingCustomer.ExpireAt.After(time.Now()) {
		inlineKeyboard = append(inlineKeyboard, h.resolveConnectButton(langCode))
	}

	// Собираем кнопки для 2-в-ряд начиная с "Рефералы"
	var twoInRow []models.InlineKeyboardButton

	if config.GetReferralDays() > 0 {
		twoInRow = append(twoInRow, models.InlineKeyboardButton{Text: h.translation.GetText(langCode, "referral_button"), CallbackData: CallbackReferral})
	}
	if config.ServerStatusURL() != "" {
		twoInRow = append(twoInRow, models.InlineKeyboardButton{Text: h.translation.GetText(langCode, "server_status_button"), URL: config.ServerStatusURL()})
	}
	if config.FeedbackURL() != "" {
		twoInRow = append(twoInRow, models.InlineKeyboardButton{Text: h.translation.GetText(langCode, "feedback_button"), URL: config.FeedbackURL()})
	}
	if config.ChannelURL() != "" {
		twoInRow = append(twoInRow, models.InlineKeyboardButton{Text: h.translation.GetText(langCode, "channel_button"), URL: config.ChannelURL()})
	}
	if config.TosURL() != "" {
		twoInRow = append(twoInRow, models.InlineKeyboardButton{Text: h.translation.GetText(langCode, "tos_button"), URL: config.TosURL()})
	}

	// Добавляем кнопки по 2 в ряд
	for i := 0; i < len(twoInRow); i += 2 {
		if i+1 < len(twoInRow) {
			inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{twoInRow[i], twoInRow[i+1]})
		} else {
			inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{twoInRow[i]})
		}
	}

	// Добавляем кнопку "Помощь" в конец
	inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{{Text: "📚 Помощь", CallbackData: "help"}})

	return inlineKeyboard
}
