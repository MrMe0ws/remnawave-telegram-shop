package handler

import (
	"context"
	"fmt"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/translation"
)

func (h Handler) ReferralCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("error finding customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("customer not found", "telegramId", update.CallbackQuery.From.ID)
		return
	}
	langCode := update.CallbackQuery.From.LanguageCode
	refCode := customer.TelegramID

	refLink := fmt.Sprintf("https://telegram.me/share/url?url=https://t.me/%s?start=ref_%d", update.CallbackQuery.Message.Message.From.Username, refCode)

	stats, err := h.referralRepository.GetStats(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("error calculating referral stats", "error", err)
		return
	}

	description := buildReferralDescription(langCode)
	text := description + fmt.Sprintf(
		h.translation.GetText(langCode, "referral_stats"),
		stats.Total,
		stats.Paid,
		stats.Active,
		stats.Conversion,
		stats.EarnedTotal,
		stats.EarnedLastMonth,
	)
	callbackMessage := update.CallbackQuery.Message.Message
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
				h.translation.WithButton(langCode, "referral_list_button", models.InlineKeyboardButton{CallbackData: CallbackReferralList}),
			},
			{
				h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackStart}),
			},
		}},
	})
	if err != nil {
		slog.Error("Error sending referral message", "error", err)
	}
}

func buildReferralDescription(langCode string) string {
	tm := translation.GetInstance()
	mode := config.ReferralMode()
	if mode == "progressive" {
		return fmt.Sprintf(
			tm.GetText(langCode, "referral_desc_progressive"),
			config.ReferralFirstReferrerDays(),
			config.ReferralFirstRefereeDays(),
			config.ReferralRepeatReferrerDays(),
		)
	}
	return fmt.Sprintf(tm.GetText(langCode, "referral_desc_default"), config.GetReferralDays())
}
