package handler

import (
	"context"
	"fmt"
	"strings"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

func (h Handler) LoyaltyRootCallbackHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if !config.LoyaltyEnabled() || h.loyaltyTierRepository == nil {
		return
	}
	customer, err := h.customerRepository.FindByTelegramId(ctx, update.CallbackQuery.From.ID)
	if err != nil {
		slog.Error("loyalty screen customer", "error", err)
		return
	}
	if customer == nil {
		slog.Error("loyalty screen customer nil", "telegramId", update.CallbackQuery.From.ID)
		return
	}
	langCode := update.CallbackQuery.From.LanguageCode
	callbackMessage := update.CallbackQuery.Message.Message
	text := h.buildLoyaltyScreenHTML(ctx, customer, langCode)
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		Text:      text,
		ParseMode: models.ParseModeHTML,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{
				h.translation.WithButton(langCode, "back_button", models.InlineKeyboardButton{CallbackData: CallbackConnect}),
			},
		}},
	})
	logEditError("loyalty screen edit", err)
}

func (h Handler) buildLoyaltyScreenHTML(ctx context.Context, customer *database.Customer, lang string) string {
	tm := h.translation
	if h.loyaltyTierRepository == nil {
		return tm.GetText(lang, "loyalty_screen_unavailable")
	}
	prog, err := h.loyaltyTierRepository.ProgressForXP(ctx, customer.LoyaltyXP)
	if err != nil {
		slog.Error("loyalty progress screen", "error", err)
		return tm.GetText(lang, "loyalty_screen_unavailable")
	}
	cur := prog.CurrentTier
	var b strings.Builder
	b.WriteString(tm.GetText(lang, "loyalty_screen_title"))
	b.WriteString("\n\n")
	if cur.SortOrder == 0 && cur.DiscountPercent == 0 && prog.NextTier != nil {
		b.WriteString(tm.GetText(lang, "loyalty_screen_level0_hint"))
		b.WriteString("\n\n")
	}
	b.WriteString(fmt.Sprintf(tm.GetText(lang, "loyalty_screen_level_line"), loyaltyTierLabelHTML(cur)))
	b.WriteString("\n")
	b.WriteString(fmt.Sprintf(tm.GetText(lang, "loyalty_screen_xp_line"), customer.LoyaltyXP))
	b.WriteString("\n")
	b.WriteString(fmt.Sprintf(tm.GetText(lang, "loyalty_screen_discount_line"), cur.DiscountPercent))
	b.WriteString("\n\n")
	if prog.NextTier != nil {
		next := prog.NextTier
		need := next.XpMin - customer.LoyaltyXP
		if need < 0 {
			need = 0
		}
		b.WriteString(fmt.Sprintf(tm.GetText(lang, "loyalty_screen_next_level_line"),
			loyaltyTierLabelHTML(*next), next.DiscountPercent, need))
		b.WriteString("\n\n")
	} else {
		b.WriteString(tm.GetText(lang, "loyalty_screen_max_level"))
		b.WriteString("\n\n")
	}
	b.WriteString(tm.GetText(lang, "loyalty_screen_how_it_works"))
	return b.String()
}

func loyaltyTierLabelHTML(t database.LoyaltyTier) string {
	if t.DisplayName != nil && strings.TrimSpace(*t.DisplayName) != "" {
		return escapeHTML(strings.TrimSpace(*t.DisplayName))
	}
	return escapeHTML(fmt.Sprintf("#%d", t.SortOrder))
}
