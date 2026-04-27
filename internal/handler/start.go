package handler

import (
	"context"
	"strconv"
	"strings"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	cabcfg "remnawave-tg-shop-bot/internal/cabinet/config"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

func (h Handler) StartCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
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

	linkPreviewOff := true

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
		LinkPreviewOptions: &models.LinkPreviewOptions{
			IsDisabled: &linkPreviewOff,
		},
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: inlineKeyboard,
		},
		Text: h.translation.GetText(langCode, "greeting"),
	})
	logEditError("Error sending /start message", err)
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

	linkPreviewOff := true
	lp := &models.LinkPreviewOptions{IsDisabled: &linkPreviewOff}
	err = SendOrEditAfterInlineCallback(ctxWithTime, b, update, h.translation.GetText(langCode, "greeting"), models.ParseModeHTML, models.InlineKeyboardMarkup{
		InlineKeyboard: inlineKeyboard,
	}, lp)
	if err != nil {
		slog.Error("Error sending /start message", err)
	}
}

func (h Handler) resolveConnectButton(lang string) []models.InlineKeyboardButton {
	// При включённом кабинете «Мой VPN» сразу открывает WebApp кабинета (тот же функционал, что подменю).
	if u := cabcfg.MiniAppEntryURL(); u != "" {
		return []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "connect_button", models.InlineKeyboardButton{
				WebApp: &models.WebAppInfo{URL: u},
			}),
		}
	}
	return []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "connect_button", models.InlineKeyboardButton{CallbackData: CallbackConnect}),
	}
}

func (h Handler) HelpCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	callback := update.CallbackQuery

	if callback == nil || callback.Message.Message == nil {
		slog.Error("HelpCallbackHandler: callback.Message.Message is nil")
		return
	}

	langCode := callback.From.LanguageCode
	var helpKeyboard [][]models.InlineKeyboardButton

	// Ряд 1: «Какой сервер выбрать», «Видеоинструкция»
	var serverVideoRow []models.InlineKeyboardButton
	if config.ServerSelectionURL() != "" {
		serverVideoRow = append(serverVideoRow, h.translation.WithButton(langCode, "server_selection_button", models.InlineKeyboardButton{
			URL: config.ServerSelectionURL(),
		}))
	}
	if config.VideoGuideURL() != "" {
		serverVideoRow = append(serverVideoRow, h.translation.WithButton(langCode, "video_guide_button", models.InlineKeyboardButton{
			URL: config.VideoGuideURL(),
		}))
	}
	if len(serverVideoRow) > 0 {
		helpKeyboard = append(helpKeyboard, serverVideoRow)
	}

	// Ряд 2: только «Поддержка»
	if config.SupportURL() != "" {
		helpKeyboard = append(helpKeyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "support_button", models.InlineKeyboardButton{URL: config.SupportURL()}),
		})
	}

	// Ряд 3: «Публичная оферта», «Политика конфиденциальности»
	var offerPrivacyRow []models.InlineKeyboardButton
	if config.PublicOfferURL() != "" {
		offerPrivacyRow = append(offerPrivacyRow, h.translation.WithButton(langCode, "public_offer_button", models.InlineKeyboardButton{
			URL: config.PublicOfferURL(),
		}))
	}
	if config.PrivacyPolicyURL() != "" {
		offerPrivacyRow = append(offerPrivacyRow, h.translation.WithButton(langCode, "privacy_policy_button", models.InlineKeyboardButton{
			URL: config.PrivacyPolicyURL(),
		}))
	}
	if len(offerPrivacyRow) > 0 {
		helpKeyboard = append(helpKeyboard, offerPrivacyRow)
	}

	// Ряд 4: «Пользовательское соглашение»
	if config.TermsOfServiceURL() != "" {
		helpKeyboard = append(helpKeyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "terms_of_service_button", models.InlineKeyboardButton{URL: config.TermsOfServiceURL()}),
		})
	}

	// Кнопка "Назад"
	helpKeyboard = append(helpKeyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackStart}),
	})

	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callback.Message.Message.Chat.ID,
		MessageID: callback.Message.Message.ID,
		ParseMode: models.ParseModeHTML,
		Text:      h.translation.GetText(langCode, "help_title"),
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: helpKeyboard,
		},
	})
	logEditError("Error sending help message", err)
}

func (h Handler) buildStartKeyboard(existingCustomer *database.Customer, langCode string) [][]models.InlineKeyboardButton {
	var inlineKeyboard [][]models.InlineKeyboardButton

	// 1. Попробовать бесплатно (если юзер новый)
	if existingCustomer.SubscriptionLink == nil && config.TrialDays() > 0 {
		inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "trial_button", models.InlineKeyboardButton{CallbackData: CallbackTrial}),
		})
	}

	// 2. Купить (всегда показывается)
	inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "buy_button", models.InlineKeyboardButton{CallbackData: CallbackBuy}),
	})

	// 3. Подключиться (если есть подписка)
	if existingCustomer.SubscriptionLink != nil {
		inlineKeyboard = append(inlineKeyboard, h.resolveConnectButton(langCode))
	}

	// 4. Собираем кнопки для 2-в-ряд: отзывы, канал
	var secondRow []models.InlineKeyboardButton
	if config.FeedbackURL() != "" {
		secondRow = append(secondRow, h.translation.WithButton(langCode, "feedback_button", models.InlineKeyboardButton{URL: config.FeedbackURL()}))
	}
	if config.ChannelURL() != "" {
		secondRow = append(secondRow, h.translation.WithButton(langCode, "channel_button", models.InlineKeyboardButton{URL: config.ChannelURL()}))
	}
	if len(secondRow) > 0 {
		inlineKeyboard = append(inlineKeyboard, secondRow)
	}

	inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "promo_code_button", models.InlineKeyboardButton{CallbackData: CallbackEnterPromo}),
	})

	inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "help_button", models.InlineKeyboardButton{CallbackData: "help"}),
	})

	if existingCustomer.TelegramID == config.GetAdminTelegramId() {
		inlineKeyboard = append(inlineKeyboard, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "admin_panel_button", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel}),
		})
	}

	return inlineKeyboard
}
