package handler

import (
	"context"
	"fmt"
	"strings"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/utils"
)

func (h Handler) ReferralListCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.Message.Message == nil {
		return
	}
	callbackMessage := update.CallbackQuery.Message.Message
	langCode := update.CallbackQuery.From.LanguageCode

	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("error finding customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("customer not found", "telegramId", utils.MaskHalfInt64(update.CallbackQuery.From.ID))
		return
	}

	refLink := fmt.Sprintf("https://telegram.me/share/url?url=https://t.me/%s?start=ref_%d", update.CallbackQuery.Message.Message.From.Username, customer.TelegramID)

	referrals, err := h.referralRepository.FindRefereeSummariesByReferrer(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("error finding referral list", "error", err)
		return
	}

	text := buildReferralListText(langCode, referrals)
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		Text:      text,
		ParseMode: models.ParseModeHTML,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{
				h.translation.WithButton(langCode, "share_referral_button", models.InlineKeyboardButton{URL: refLink}),
			},
			{
				h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackReferral}),
			},
		}},
	})
	if err != nil {
		slog.Error("Error sending referral list message", "error", err)
	}
}

func buildReferralListText(langCode string, referrals []database.RefereeSummary) string {
	tm := translation.GetInstance()
	if len(referrals) == 0 {
		return tm.GetText(langCode, "referral_list_empty")
	}

	var sb strings.Builder
	sb.WriteString(tm.GetText(langCode, "referral_list_title"))
	sb.WriteString("\n\n")

	for i, ref := range referrals {
		if i > 0 {
			sb.WriteString("\n")
		}
		statusKey := "referral_list_status_inactive"
		if ref.Active {
			statusKey = "referral_list_status_active"
		}
		status := tm.GetText(langCode, statusKey)
		sb.WriteString(fmt.Sprintf(tm.GetText(langCode, "referral_list_item"), ref.TelegramID, status))
	}

	return sb.String()
}
