package handler

import (
	"context"
	"fmt"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
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

	// Получаем общее количество приглашенных
	totalCount, err := h.referralRepository.CountByReferrer(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("error counting referrals", err)
		return
	}

	// Получаем количество оплативших рефералов
	paidCount, err := h.referralRepository.CountPaidReferralsByReferrer(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("error counting paid referrals", err)
		return
	}

	// Получаем количество заработанных дней
	earnedDays, err := h.referralRepository.CalculateEarnedDays(ctx, customer.TelegramID)
	if err != nil {
		slog.Error("error calculating earned days", err)
		return
	}

	// Форматируем текст с тремя аргументами
	text := fmt.Sprintf(h.translation.GetText(langCode, "referral_text"), totalCount, paidCount, earnedDays)
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
				h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackStart}),
			},
		}},
	})
	if err != nil {
		slog.Error("Error sending referral message", err)
	}
}
