package handler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/utils"
)

func (h Handler) ConnectCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	customer, err := h.customerRepository.FindByTelegramId(ctx, update.Message.Chat.ID)
	if err != nil {
		slog.Error("Error finding customer", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "telegramId", utils.MaskHalfInt64(update.Message.Chat.ID), "error", err)
		return
	}

	langCode := update.Message.From.LanguageCode

	// Проверяем, истекла ли подписка
	isExpired := false
	if customer.ExpireAt != nil {
		currentTime := time.Now()
		if !currentTime.Before(*customer.ExpireAt) {
			isExpired = true
		}
	} else {
		isExpired = true
	}

	var markup [][]models.InlineKeyboardButton

	if customer.SubscriptionLink != nil && !isExpired {
		// Если указан MINI_APP_URL, используем его, иначе используем subscription_link
		var webAppURL string
		if config.GetMiniAppURL() != "" {
			webAppURL = config.GetMiniAppURL()
		} else {
			webAppURL = *customer.SubscriptionLink
		}
		markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "connect_device_button"),
			WebApp: &models.WebAppInfo{
				URL: webAppURL,
			}}})
		markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "devices_button"), CallbackData: CallbackDevices}})

		// Кнопки Рефералы и Статус серверов в одном ряду
		var referralAndStatusRow []models.InlineKeyboardButton
		// Рефералы показываем всегда (если подписка активна)
		referralAndStatusRow = append(referralAndStatusRow, models.InlineKeyboardButton{
			Text:         h.translation.GetText(langCode, "referral_button"),
			CallbackData: CallbackReferral,
		})
		// Статус серверов показываем только если URL указан
		if config.ServerStatusURL() != "" {
			referralAndStatusRow = append(referralAndStatusRow, models.InlineKeyboardButton{
				Text: h.translation.GetText(langCode, "server_status_button"),
				URL:  config.ServerStatusURL(),
			})
		}
		if len(referralAndStatusRow) > 0 {
			markup = append(markup, referralAndStatusRow)
		}
	}

	// Если подписка истекла, показываем кнопку "Купить"
	if isExpired {
		markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "buy_button"), CallbackData: CallbackBuy}})
	}

	markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "back_button"), CallbackData: CallbackStart}})

	isDisabled := true
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    update.Message.Chat.ID,
		Text:      h.buildConnectText(ctx, customer, langCode),
		ParseMode: models.ParseModeHTML,
		LinkPreviewOptions: &models.LinkPreviewOptions{
			IsDisabled: &isDisabled,
		},
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: markup,
		},
	})

	if err != nil {
		slog.Error("Error sending connect message", err)
	}
}

func (h Handler) ConnectCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	callback := update.CallbackQuery.Message.Message

	customer, err := h.customerRepository.FindByTelegramId(ctx, callback.Chat.ID)
	if err != nil {
		slog.Error("Error finding customer", err)
		return
	}
	if customer == nil {
		slog.Error("customer not exist", "telegramId", utils.MaskHalfInt64(callback.Chat.ID), "error", err)
		return
	}

	langCode := update.CallbackQuery.From.LanguageCode

	var markup [][]models.InlineKeyboardButton

	// Проверяем, истекла ли подписка
	isExpired := false
	if customer.ExpireAt != nil {
		currentTime := time.Now()
		if !currentTime.Before(*customer.ExpireAt) {
			isExpired = true
		}
	} else {
		isExpired = true
	}

	if customer.SubscriptionLink != nil && !isExpired {
		// Если указан MINI_APP_URL, используем его, иначе используем subscription_link
		var webAppURL string
		if config.GetMiniAppURL() != "" {
			webAppURL = config.GetMiniAppURL()
		} else {
			webAppURL = *customer.SubscriptionLink
		}
		markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "connect_device_button"),
			WebApp: &models.WebAppInfo{
				URL: webAppURL,
			}}})
		markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "devices_button"), CallbackData: CallbackDevices}})

		// Кнопки Рефералы и Статус серверов в одном ряду
		var referralAndStatusRow []models.InlineKeyboardButton
		// Рефералы показываем всегда (если подписка активна)
		referralAndStatusRow = append(referralAndStatusRow, models.InlineKeyboardButton{
			Text:         h.translation.GetText(langCode, "referral_button"),
			CallbackData: CallbackReferral,
		})
		// Статус серверов показываем только если URL указан
		if config.ServerStatusURL() != "" {
			referralAndStatusRow = append(referralAndStatusRow, models.InlineKeyboardButton{
				Text: h.translation.GetText(langCode, "server_status_button"),
				URL:  config.ServerStatusURL(),
			})
		}
		if len(referralAndStatusRow) > 0 {
			markup = append(markup, referralAndStatusRow)
		}
	}

	// Если подписка истекла, показываем кнопку "Купить"
	if isExpired {
		markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "buy_button"), CallbackData: CallbackBuy}})
	}

	markup = append(markup, []models.InlineKeyboardButton{{Text: h.translation.GetText(langCode, "back_button"), CallbackData: CallbackStart}})

	isDisabled := true
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callback.Chat.ID,
		MessageID: callback.ID,
		ParseMode: models.ParseModeHTML,
		Text:      h.buildConnectText(ctx, customer, langCode),
		LinkPreviewOptions: &models.LinkPreviewOptions{
			IsDisabled: &isDisabled,
		},
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: markup,
		},
	})

	if err != nil {
		slog.Error("Error sending connect message", err)
	}
}

func (h Handler) buildConnectText(ctx context.Context, customer *database.Customer, langCode string) string {
	var info strings.Builder

	tm := translation.GetInstance()

	if customer.ExpireAt != nil {
		currentTime := time.Now()

		if currentTime.Before(*customer.ExpireAt) {
			formattedDate := customer.ExpireAt.Format("02.01.2006 15:04")

			subscriptionActiveText := tm.GetText(langCode, "subscription_active")
			info.WriteString(fmt.Sprintf(subscriptionActiveText, formattedDate))

			// Получаем информацию о лимите трафика
			userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
			if err == nil && userInfo != nil {
				// Проверяем, есть ли лимит трафика
				if userInfo.TrafficLimitBytes.IsSet() && userInfo.TrafficLimitBytes.Value > 0 {
					trafficLimitBytes := userInfo.TrafficLimitBytes.Value

					// Получаем использованный трафик
					usedTrafficBytes := int64(userInfo.UsedTrafficBytes)

					// Конвертируем байты в гигабайты (1 GB = 1073741824 байт)
					bytesInGigabyte := float64(1073741824)
					usedGB := float64(usedTrafficBytes) / bytesInGigabyte
					limitGB := float64(trafficLimitBytes) / bytesInGigabyte

					// Форматируем с одним знаком после запятой
					usedGBStr := fmt.Sprintf("%.1f", usedGB)
					limitGBStr := fmt.Sprintf("%.1f", limitGB)

					trafficLimitText := tm.GetText(langCode, "traffic_limit")
					info.WriteString(fmt.Sprintf(trafficLimitText, usedGBStr, limitGBStr))
				}
			}

			// Добавляем ссылку на подписку
			if customer.SubscriptionLink != nil && *customer.SubscriptionLink != "" {
				subscriptionLinkText := tm.GetText(langCode, "subscription_link")
				info.WriteString(fmt.Sprintf(subscriptionLinkText, *customer.SubscriptionLink))
			}
		} else {
			noSubscriptionText := tm.GetText(langCode, "no_subscription")
			info.WriteString(noSubscriptionText)
		}
	} else {
		noSubscriptionText := tm.GetText(langCode, "no_subscription")
		info.WriteString(noSubscriptionText)
	}

	return info.String()
}
