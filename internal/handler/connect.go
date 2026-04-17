package handler

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/google/uuid"

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
	if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
		slog.Error("Error cleaning expired extra hwid", "error", err)
		return
	}

	langCode := update.Message.From.LanguageCode

	var markup [][]models.InlineKeyboardButton
	if customer.SubscriptionLink != nil && customer.ExpireAt != nil && customer.ExpireAt.After(time.Now()) {
		// Если есть активная подписка, показываем кнопки подключения
		markup = append(markup, h.resolveConnectDeviceButton(langCode, customer.SubscriptionLink))
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "manage_devices_button", models.InlineKeyboardButton{CallbackData: CallbackManageDevices}),
		})
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "purchase_history_button", models.InlineKeyboardButton{CallbackData: CallbackPurchaseHistory}),
		})

		// Добавляем кнопки "Рефералы" и "Статус серверов" в одном ряду
		var referralAndStatusRow []models.InlineKeyboardButton
		// Кнопка "Рефералы" всегда показывается при активной подписке
		referralAndStatusRow = append(referralAndStatusRow, h.translation.WithButton(langCode, "referral_button", models.InlineKeyboardButton{
			CallbackData: CallbackReferral,
		}))
		if config.ServerStatusURL() != "" {
			referralAndStatusRow = append(referralAndStatusRow, h.translation.WithButton(langCode, "server_status_button", models.InlineKeyboardButton{
				URL: config.ServerStatusURL(),
			}))
		}
		markup = append(markup, referralAndStatusRow)
	} else {
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "buy_button", models.InlineKeyboardButton{CallbackData: CallbackBuy}),
		})
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "purchase_history_button", models.InlineKeyboardButton{CallbackData: CallbackPurchaseHistory}),
		})
		var referralInactiveRow []models.InlineKeyboardButton
		referralInactiveRow = append(referralInactiveRow, h.translation.WithButton(langCode, "referral_button", models.InlineKeyboardButton{
			CallbackData: CallbackReferral,
		}))
		if config.ServerStatusURL() != "" {
			referralInactiveRow = append(referralInactiveRow, h.translation.WithButton(langCode, "server_status_button", models.InlineKeyboardButton{
				URL: config.ServerStatusURL(),
			}))
		}
		markup = append(markup, referralInactiveRow)
	}
	markup = append(markup, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackStart}),
	})

	isDisabled := true
	displayName := buildDisplayName(update.Message.From.FirstName, update.Message.From.LastName, update.Message.From.Username)
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    update.Message.Chat.ID,
		Text:      h.buildConnectText(ctx, customer, langCode, displayName),
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
	if err := h.cleanupExpiredExtraHwid(ctx, customer); err != nil {
		slog.Error("Error cleaning expired extra hwid", "error", err)
		return
	}

	langCode := update.CallbackQuery.From.LanguageCode

	var markup [][]models.InlineKeyboardButton
	if customer.SubscriptionLink != nil && customer.ExpireAt != nil && customer.ExpireAt.After(time.Now()) {
		// Если есть активная подписка, показываем кнопки подключения
		markup = append(markup, h.resolveConnectDeviceButton(langCode, customer.SubscriptionLink))
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "manage_devices_button", models.InlineKeyboardButton{CallbackData: CallbackManageDevices}),
		})
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "purchase_history_button", models.InlineKeyboardButton{CallbackData: CallbackPurchaseHistory}),
		})

		// Добавляем кнопки "Рефералы" и "Статус серверов" в одном ряду
		var referralAndStatusRow []models.InlineKeyboardButton
		// Кнопка "Рефералы" всегда показывается при активной подписке
		referralAndStatusRow = append(referralAndStatusRow, h.translation.WithButton(langCode, "referral_button", models.InlineKeyboardButton{
			CallbackData: CallbackReferral,
		}))
		if config.ServerStatusURL() != "" {
			referralAndStatusRow = append(referralAndStatusRow, h.translation.WithButton(langCode, "server_status_button", models.InlineKeyboardButton{
				URL: config.ServerStatusURL(),
			}))
		}
		markup = append(markup, referralAndStatusRow)
	} else {
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "buy_button", models.InlineKeyboardButton{CallbackData: CallbackBuy}),
		})
		markup = append(markup, []models.InlineKeyboardButton{
			h.translation.WithButton(langCode, "purchase_history_button", models.InlineKeyboardButton{CallbackData: CallbackPurchaseHistory}),
		})
		var referralInactiveRow []models.InlineKeyboardButton
		referralInactiveRow = append(referralInactiveRow, h.translation.WithButton(langCode, "referral_button", models.InlineKeyboardButton{
			CallbackData: CallbackReferral,
		}))
		if config.ServerStatusURL() != "" {
			referralInactiveRow = append(referralInactiveRow, h.translation.WithButton(langCode, "server_status_button", models.InlineKeyboardButton{
				URL: config.ServerStatusURL(),
			}))
		}
		markup = append(markup, referralInactiveRow)
	}
	markup = append(markup, []models.InlineKeyboardButton{
		h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackStart}),
	})

	isDisabled := true
	displayName := buildDisplayName(update.CallbackQuery.From.FirstName, update.CallbackQuery.From.LastName, update.CallbackQuery.From.Username)
	lp := &models.LinkPreviewOptions{IsDisabled: &isDisabled}
	err = SendOrEditAfterInlineCallback(ctx, b, update, h.buildConnectText(ctx, customer, langCode, displayName), models.ParseModeHTML, models.InlineKeyboardMarkup{
		InlineKeyboard: markup,
	}, lp)

	logEditError("Error sending connect message", err)
}

func (h Handler) buildConnectText(ctx context.Context, customer *database.Customer, langCode, displayName string) string {
	var info strings.Builder

	tm := translation.GetInstance()

	now := time.Now()
	isActive := customer.ExpireAt != nil && now.Before(*customer.ExpireAt)
	if !isActive {
		if h.promoService != nil {
			pct, untilFirst, expAt, ok, errPD := h.promoService.PendingDiscountForConnectUI(ctx, customer.ID)
			if errPD != nil {
				slog.Error("pending discount connect ui", "error", errPD)
			} else if ok && pct > 0 {
				var sb strings.Builder
				sb.WriteString(tm.GetText(langCode, "no_subscription"))
				sb.WriteString("\n\n")
				sb.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_pending_discount_line"), pct))
				sb.WriteString("\n")
				if untilFirst {
					sb.WriteString(tm.GetText(langCode, "vpn_pending_discount_until_first"))
				} else if expAt != nil {
					if left := formatDiscountTimeLeft(langCode, *expAt, now); left != "" {
						sb.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_pending_discount_timer"), left))
					}
				}
				return sb.String()
			}
		}
		return tm.GetText(langCode, "no_subscription")
	}

	name := strings.TrimSpace(displayName)
	if name == "" {
		name = tm.GetText(langCode, "vpn_username_unknown")
	}

	info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_username"), escapeHTML(name)))
	info.WriteString("\n")
	if isActive {
		info.WriteString(tm.GetText(langCode, "vpn_status_active"))
	} else {
		info.WriteString(tm.GetText(langCode, "vpn_status_inactive"))
	}

	info.WriteString("\n\n")
	info.WriteString(tm.GetText(langCode, "vpn_subscription_info_title"))
	info.WriteString("\n")

	if config.SalesMode() == "tariffs" && h.tariffRepository != nil && customer.CurrentTariffID != nil && *customer.CurrentTariffID > 0 {
		tariff, err := h.tariffRepository.GetByID(ctx, *customer.CurrentTariffID)
		if err == nil && tariff != nil {
			tariffLabel := escapeHTML(displayTariffName(tariff))
			info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_current_tariff_line"), tariffLabel))
			info.WriteString("\n")
		}
	}

	expireAtText := tm.GetText(langCode, "vpn_not_available")
	if customer.ExpireAt != nil {
		expireAtText = customer.ExpireAt.Format("02.01.2006 15:04")
	}
	info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_expires_at"), expireAtText))
	info.WriteString("\n")

	if customer.ExpireAt != nil {
		info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_days_left"), daysLeft(*customer.ExpireAt, now)))
		info.WriteString("\n")
	}

	trafficUsed := tm.GetText(langCode, "vpn_not_available")
	trafficLimit := tm.GetText(langCode, "vpn_not_available")
	deviceCount := tm.GetText(langCode, "vpn_not_available")
	deviceLimit := tm.GetText(langCode, "vpn_not_available")
	showDevices := false

	userInfo, err := h.syncService.GetRemnawaveClient().GetUserTrafficInfo(ctx, customer.TelegramID)
	if err == nil && userInfo != nil {
		trafficUsed = formatGigabytes(userInfo.UserTraffic.UsedTrafficBytes)
		if userInfo.TrafficLimitBytes > 0 {
			trafficLimit = formatGigabytes(float64(userInfo.TrafficLimitBytes))
		} else {
			trafficLimit = tm.GetText(langCode, "vpn_unlimited")
		}

		deviceLimitValue := 0
		if userInfo.HwidDeviceLimit != nil && *userInfo.HwidDeviceLimit > 0 {
			deviceLimitValue = *userInfo.HwidDeviceLimit
		} else {
			deviceLimitValue = config.GetHwidFallbackDeviceLimit()
		}
		if deviceLimitValue > 0 {
			deviceLimit = strconv.Itoa(deviceLimitValue)
			showDevices = true
		}

		if userInfo.UUID != uuid.Nil {
			devices, err := h.syncService.GetRemnawaveClient().GetUserDevicesByUuid(ctx, userInfo.UUID.String())
			if err == nil {
				deviceCount = strconv.Itoa(len(devices))
			}
		}
	}

	info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_traffic"), trafficUsed, trafficLimit))
	if showDevices {
		info.WriteString("\n")
		info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_devices"), deviceCount, deviceLimit))
	}

	if h.promoService != nil {
		pct, untilFirst, expAt, ok, errPD := h.promoService.PendingDiscountForConnectUI(ctx, customer.ID)
		if errPD != nil {
			slog.Error("pending discount connect ui", "error", errPD)
		} else if ok && pct > 0 {
			info.WriteString("\n\n")
			info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_pending_discount_line"), pct))
			info.WriteString("\n")
			if untilFirst {
				info.WriteString(tm.GetText(langCode, "vpn_pending_discount_until_first"))
			} else if expAt != nil {
				if left := formatDiscountTimeLeft(langCode, *expAt, now); left != "" {
					info.WriteString(fmt.Sprintf(tm.GetText(langCode, "vpn_pending_discount_timer"), left))
				}
			}
		}
	}

	if customer.SubscriptionLink != nil && *customer.SubscriptionLink != "" {
		info.WriteString("\n\n")
		info.WriteString(tm.GetText(langCode, "vpn_subscription_link_title"))
		info.WriteString("\n")
		info.WriteString(escapeHTML(*customer.SubscriptionLink))
		info.WriteString("\n\n")
		info.WriteString(tm.GetText(langCode, "vpn_subscription_link_hint"))
	}

	return info.String()
}

func buildDisplayName(firstName, lastName, username string) string {
	fullName := strings.TrimSpace(strings.TrimSpace(firstName + " " + lastName))
	if fullName != "" {
		return fullName
	}
	return strings.TrimSpace(strings.TrimPrefix(username, "@"))
}

func formatDiscountTimeLeft(lang string, expiresAt, now time.Time) string {
	if !expiresAt.After(now) {
		return ""
	}
	d := expiresAt.Sub(now)
	totalMin := int(d.Minutes())
	if totalMin < 1 {
		totalMin = 1
	}
	days := totalMin / (24 * 60)
	h := (totalMin % (24 * 60)) / 60
	m := totalMin % 60
	if lang == "ru" {
		if days > 0 {
			return fmt.Sprintf("%d дн. %d ч.", days, h)
		}
		return fmt.Sprintf("%dч %dм", h, m)
	}
	if days > 0 {
		return fmt.Sprintf("%d d %d h", days, h)
	}
	return fmt.Sprintf("%dh %dm", h, m)
}

func daysLeft(expireAt, now time.Time) int {
	if expireAt.Before(now) {
		return 0
	}
	days := int(math.Ceil(expireAt.Sub(now).Hours() / 24))
	if days < 0 {
		return 0
	}
	return days
}

func formatGigabytes(bytes float64) string {
	if bytes <= 0 {
		return "0.0"
	}
	const bytesInGigabyte = 1073741824
	return fmt.Sprintf("%.1f", bytes/bytesInGigabyte)
}

func escapeHTML(value string) string {
	replacer := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
	)
	return replacer.Replace(value)
}

func (h Handler) resolveConnectDeviceButton(lang string, subscriptionLink *string) []models.InlineKeyboardButton {
	var inlineKeyboard []models.InlineKeyboardButton

	if config.GetMiniAppURL() != "" {
		// Если указан MINI_APP_URL, используем его
		inlineKeyboard = []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "connect_device_button", models.InlineKeyboardButton{WebApp: &models.WebAppInfo{
				URL: config.GetMiniAppURL(),
			}}),
		}
	} else if subscriptionLink != nil && *subscriptionLink != "" {
		// Если MINI_APP_URL не указан, используем subscriptionLink как webapp
		inlineKeyboard = []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "connect_device_button", models.InlineKeyboardButton{WebApp: &models.WebAppInfo{
				URL: *subscriptionLink,
			}}),
		}
	} else {
		// Если нет ни того, ни другого, используем callback
		inlineKeyboard = []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "connect_device_button", models.InlineKeyboardButton{CallbackData: CallbackConnect}),
		}
	}
	return inlineKeyboard
}

func (h Handler) hasPaidSubscription(ctx context.Context, customerID int64) bool {
	hasPaid, err := h.purchaseRepository.HasPaidSubscription(ctx, customerID)
	if err != nil {
		slog.Error("Error checking paid purchase", "error", err)
		return false
	}
	return hasPaid
}
