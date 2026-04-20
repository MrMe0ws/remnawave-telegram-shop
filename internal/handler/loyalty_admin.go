package handler

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/loyalty"
)

type adminLoyaltyEditPending struct {
	TierID int64
	Field  string // "xp" | "pct" | "dn"
}

var adminLoyaltyState = struct {
	mu      sync.Mutex
	edit    map[int64]*adminLoyaltyEditPending
	newStep map[int64]string // "xp" | "pct"
	newXp   map[int64]int64
}{
	edit:    make(map[int64]*adminLoyaltyEditPending),
	newStep: make(map[int64]string),
	newXp:   make(map[int64]int64),
}

func adminLoyaltyClear(adminID int64) {
	adminLoyaltyState.mu.Lock()
	delete(adminLoyaltyState.edit, adminID)
	delete(adminLoyaltyState.newStep, adminID)
	delete(adminLoyaltyState.newXp, adminID)
	adminLoyaltyState.mu.Unlock()
}

// AdminLoyaltyWaiting — админ вводит число для уровня или мастера «новый уровень».
func AdminLoyaltyWaiting(adminID int64) bool {
	adminLoyaltyState.mu.Lock()
	defer adminLoyaltyState.mu.Unlock()
	if adminLoyaltyState.edit[adminID] != nil {
		return true
	}
	return adminLoyaltyState.newStep[adminID] != ""
}

func parseLoyaltyTierID(callbackData string) int64 {
	idx := strings.Index(callbackData, "?")
	if idx < 0 {
		return 0
	}
	q, err := url.ParseQuery(callbackData[idx+1:])
	if err != nil {
		return 0
	}
	id, _ := strconv.ParseInt(q.Get("i"), 10, 64)
	return id
}

func callbackLoyaltyTierCard(id int64) string {
	return fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyCard, id)
}

// AdminLoyaltyRootHandler — корень раздела лояльности в админке.
func (h Handler) AdminLoyaltyRootHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.loyaltyTierRepository == nil {
		return
	}
	var aboveZero int64
	if thr, ok, err := h.loyaltyTierRepository.MinXpMinWithPositiveDiscount(ctx); err != nil {
		slog.Error("admin loyalty min tier threshold", "error", err)
	} else if ok {
		aboveZero, _ = h.customerRepository.CountCustomersWithLoyaltyXPAtLeast(ctx, thr)
	}
	text := fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_root_text"), aboveZero)
	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "admin_loyalty_levels", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyLevels})},
		{h.translation.WithButton(lang, "admin_loyalty_statistics", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyStats})},
		{
			h.translation.WithButton(lang, "admin_loyalty_rules", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRules}),
			h.translation.WithButton(lang, "admin_loyalty_recalc", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRecalcAsk}),
		},
		{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel})},
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("admin loyalty root", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// AdminLoyaltyStatsHandler — распределение клиентов по текущим уровням (интервалы xp_min).
func (h Handler) AdminLoyaltyStatsHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	msg := cb.Message.Message
	if msg == nil || h.loyaltyTierRepository == nil {
		return
	}
	lang := cb.From.LanguageCode
	tiers, err := h.loyaltyTierRepository.ListAllOrderedByXpMinAsc(ctx)
	if err != nil {
		slog.Error("admin loyalty stats tiers", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
		return
	}
	var sb strings.Builder
	sb.WriteString(h.translation.GetText(lang, "admin_loyalty_stats_title"))
	for i, t := range tiers {
		var maxEx *int64
		if i+1 < len(tiers) {
			nx := tiers[i+1].XpMin
			maxEx = &nx
		}
		n, cntErr := h.customerRepository.CountCustomersLoyaltyXPHalfOpen(ctx, t.XpMin, maxEx)
		if cntErr != nil {
			slog.Error("admin loyalty stats count", "error", cntErr, "tier", t.SortOrder)
			_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
			return
		}
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_stats_row"),
			t.SortOrder, t.XpMin, t.DiscountPercent, n))
	}

	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRoot})},
	}
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        sb.String(),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("admin loyalty stats edit", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// AdminLoyaltyRulesHandler — экран «Правила XP» (чтение из env).
func (h Handler) AdminLoyaltyRulesHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.buildAdminLoyaltyRulesHTML(lang)
	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRoot})},
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("admin loyalty rules", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) buildAdminLoyaltyRulesHTML(lang string) string {
	m := config.LoyaltyMonthXPFallbackMap()
	months := make([]int, 0, len(m))
	for k := range m {
		months = append(months, k)
	}
	sort.Ints(months)
	var fb strings.Builder
	for _, mo := range months {
		fb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_rules_month_line"), mo, m[mo]))
	}
	if fb.Len() == 0 {
		fb.WriteString(h.translation.GetText(lang, "admin_loyalty_rules_fallback_empty"))
	}
	return fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_rules_body"),
		config.RubPerStar(),
		fb.String(),
		config.LoyaltyXPMinPerPaidPurchase(),
		config.LoyaltyMaxTotalDiscountPercent(),
	)
}

func (h Handler) adminLoyaltyLevelsEdit(ctx context.Context, b *bot.Bot, chatID, msgID int64, lang string) error {
	tiers, err := h.loyaltyTierRepository.ListAllOrderedByXpMinAsc(ctx)
	if err != nil {
		slog.Error("admin loyalty list tiers", "error", err)
		return err
	}
	var sb strings.Builder
	sb.WriteString(h.translation.GetText(lang, "admin_loyalty_levels_title"))
	sb.WriteString("\n\n")
	sb.WriteString(h.translation.GetText(lang, "admin_loyalty_levels_hint"))
	var rows [][]models.InlineKeyboardButton
	for _, t := range tiers {
		label := fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_level_row_button"),
			t.SortOrder, t.XpMin, t.DiscountPercent)
		rows = append(rows, []models.InlineKeyboardButton{
			{Text: truncateAdminBtn(label), CallbackData: callbackLoyaltyTierCard(t.ID)},
		})
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "admin_loyalty_level_add", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyNew}),
	})
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRoot}),
	})
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      chatID,
		MessageID:   int(msgID),
		ParseMode:   models.ParseModeHTML,
		Text:        sb.String(),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: rows},
	})
	return err
}

func truncateAdminBtn(s string) string {
	const max = 58
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}

// AdminLoyaltyLevelsHandler — список уровней.
func (h Handler) AdminLoyaltyLevelsHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	if err := h.adminLoyaltyLevelsEdit(ctx, b, msg.Chat.ID, int64(msg.ID), lang); err != nil {
		slog.Error("admin loyalty levels", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// AdminLoyaltyTierCardHandler — карточка уровня.
func (h Handler) AdminLoyaltyTierCardHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	id := parseLoyaltyTierID(cb.Data)
	if id <= 0 || h.loyaltyTierRepository == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
		return
	}
	tier, err := h.loyaltyTierRepository.GetByID(ctx, id)
	if err != nil || tier == nil {
		slog.Error("admin loyalty get tier", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
		return
	}
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	disp := h.translation.GetText(lang, "admin_loyalty_card_display_empty")
	if tier.DisplayName != nil && strings.TrimSpace(*tier.DisplayName) != "" {
		disp = escapeHTML(strings.TrimSpace(*tier.DisplayName))
	}
	text := fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_card_text"),
		tier.SortOrder, tier.XpMin, tier.DiscountPercent, disp,
	)
	var rows [][]models.InlineKeyboardButton
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "admin_loyalty_level_edit_xp", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyEditXP, tier.ID),
		}),
		h.translation.WithButton(lang, "admin_loyalty_level_edit_pct", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyEditPct, tier.ID),
		}),
		h.translation.WithButton(lang, "admin_loyalty_level_edit_name", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyEditDn, tier.ID),
		}),
	})
	if tier.SortOrder != 0 {
		rows = append(rows, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "admin_loyalty_level_delete", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyDelAsk, tier.ID),
			}),
		})
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyLevels}),
	})
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: rows},
	})
	if err != nil {
		slog.Error("admin loyalty card", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminLoyaltyEditXPAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	h.adminLoyaltyEditAsk(ctx, b, update, "xp")
}

func (h Handler) AdminLoyaltyEditPctAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	h.adminLoyaltyEditAsk(ctx, b, update, "pct")
}

func (h Handler) AdminLoyaltyEditDnAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	h.adminLoyaltyEditAsk(ctx, b, update, "dn")
}

func (h Handler) adminLoyaltyEditAsk(ctx context.Context, b *bot.Bot, update *models.Update, field string) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	id := parseLoyaltyTierID(cb.Data)
	if id <= 0 {
		return
	}
	adminID := cb.From.ID
	adminLoyaltyState.mu.Lock()
	adminLoyaltyState.edit[adminID] = &adminLoyaltyEditPending{TierID: id, Field: field}
	adminLoyaltyState.mu.Unlock()

	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	key := "admin_loyalty_prompt_xp"
	switch field {
	case "pct":
		key = "admin_loyalty_prompt_pct"
	case "dn":
		key = "admin_loyalty_prompt_dn"
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    msg.Chat.ID,
		MessageID: msg.ID,
		ParseMode: models.ParseModeHTML,
		Text:      h.translation.GetText(lang, key),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "admin_loyalty_cancel_edit", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyLevels})},
		}},
	})
	if err != nil {
		slog.Error("admin loyalty edit ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminLoyaltyDelAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	id := parseLoyaltyTierID(cb.Data)
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	text := h.translation.GetText(lang, "admin_loyalty_delete_confirm")
	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "confirm_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyDelYes, id)})},
		{h.translation.WithButton(lang, "cancel_button", models.InlineKeyboardButton{CallbackData: fmt.Sprintf("%s?i=%d", CallbackAdminLoyaltyCard, id)})},
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("admin loyalty del ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminLoyaltyDelYesHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	id := parseLoyaltyTierID(cb.Data)
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if id > 0 {
		if err := h.loyaltyTierRepository.Delete(ctx, id); err != nil {
			slog.Error("admin loyalty delete", "error", err)
			_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
				CallbackQueryID: cb.ID,
				Text:            h.translation.GetText(lang, "admin_loyalty_delete_fail"),
				ShowAlert:       true,
			})
			return
		}
	}
	if err := h.adminLoyaltyLevelsEdit(ctx, b, msg.Chat.ID, int64(msg.ID), lang); err != nil {
		slog.Error("admin loyalty levels after del", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminLoyaltyNewHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminID := cb.From.ID
	adminLoyaltyClear(adminID)
	adminLoyaltyState.mu.Lock()
	adminLoyaltyState.newStep[adminID] = "xp"
	adminLoyaltyState.mu.Unlock()

	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    msg.Chat.ID,
		MessageID: msg.ID,
		ParseMode: models.ParseModeHTML,
		Text:      h.translation.GetText(lang, "admin_loyalty_new_prompt_xp"),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "admin_loyalty_cancel_edit", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyLevels})},
		}},
	})
	if err != nil {
		slog.Error("admin loyalty new", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminLoyaltyRecalcAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	adminLoyaltyClear(cb.From.ID)
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "admin_loyalty_recalc_yes", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRecalcRun})},
		{h.translation.WithButton(lang, "cancel_button", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRoot})},
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        h.translation.GetText(lang, "admin_loyalty_recalc_confirm"),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("admin loyalty recalc ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminLoyaltyRecalcRunHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message

	purchases, err := h.purchaseRepository.ListAllPaidForLoyaltyBackfill(ctx)
	if err != nil {
		slog.Error("loyalty backfill list purchases", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(lang, "admin_loyalty_recalc_fail"),
			ShowAlert:       true,
		})
		return
	}
	sums := loyalty.BuildCustomerXPSumsFromPaidPurchases(purchases)
	if err := h.customerRepository.ApplyLoyaltyXPFullRecalc(ctx, sums); err != nil {
		slog.Error("loyalty backfill apply", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(lang, "admin_loyalty_recalc_fail"),
			ShowAlert:       true,
		})
		return
	}
	doneText := fmt.Sprintf(h.translation.GetText(lang, "admin_loyalty_recalc_done"),
		len(purchases), len(sums))
	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminLoyaltyRoot})},
	}
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        doneText,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("admin loyalty recalc done msg", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// AdminLoyaltyTextHandler — ввод чисел для редактирования и нового уровня.
func (h Handler) AdminLoyaltyTextHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil || update.Message.From.ID != config.GetAdminTelegramId() || !config.LoyaltyEnabled() {
		return
	}
	adminID := update.Message.From.ID
	lang := update.Message.From.LanguageCode

	adminLoyaltyState.mu.Lock()
	edit := adminLoyaltyState.edit[adminID]
	step := adminLoyaltyState.newStep[adminID]
	adminLoyaltyState.mu.Unlock()

	raw := strings.TrimSpace(update.Message.Text)
	if edit != nil && h.loyaltyTierRepository != nil {
		tier, err := h.loyaltyTierRepository.GetByID(ctx, edit.TierID)
		if err != nil || tier == nil {
			adminLoyaltyClear(adminID)
			return
		}
		if edit.Field == "dn" {
			var dn *string
			t := strings.TrimSpace(raw)
			if t != "" && t != "-" {
				if len(t) > 200 {
					t = t[:200]
				}
				dn = &t
			}
			if err := h.loyaltyTierRepository.Update(ctx, tier.ID, tier.SortOrder, tier.XpMin, tier.DiscountPercent, dn); err != nil {
				slog.Error("admin loyalty update dn", "error", err)
				return
			}
			adminLoyaltyClear(adminID)
			msg, err := b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID:    update.Message.Chat.ID,
				ParseMode: models.ParseModeHTML,
				Text:      h.translation.GetText(lang, "admin_loyalty_saved"),
			})
			if err != nil || msg == nil {
				return
			}
			_ = h.adminLoyaltyLevelsEdit(ctx, b, update.Message.Chat.ID, int64(msg.ID), lang)
			return
		}
		v, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID: update.Message.Chat.ID,
				Text:   h.translation.GetText(lang, "admin_loyalty_bad_number"),
			})
			return
		}
		switch edit.Field {
		case "xp":
			if v < 0 {
				v = 0
			}
			if err := h.loyaltyTierRepository.Update(ctx, tier.ID, tier.SortOrder, v, tier.DiscountPercent, tier.DisplayName); err != nil {
				slog.Error("admin loyalty update xp", "error", err)
				return
			}
		case "pct":
			pct := int(v)
			if pct < 0 {
				pct = 0
			}
			if pct > 100 {
				pct = 100
			}
			if err := h.loyaltyTierRepository.Update(ctx, tier.ID, tier.SortOrder, tier.XpMin, pct, tier.DisplayName); err != nil {
				slog.Error("admin loyalty update pct", "error", err)
				return
			}
		}
		adminLoyaltyClear(adminID)
		msg, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_loyalty_saved"),
		})
		if err != nil || msg == nil {
			return
		}
		_ = h.adminLoyaltyLevelsEdit(ctx, b, update.Message.Chat.ID, int64(msg.ID), lang)
		return
	}

	if step != "" && h.loyaltyTierRepository != nil {
		v, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID: update.Message.Chat.ID,
				Text:   h.translation.GetText(lang, "admin_loyalty_bad_number"),
			})
			return
		}
		if v < 0 {
			v = 0
		}
		adminLoyaltyState.mu.Lock()
		curStep := adminLoyaltyState.newStep[adminID]
		switch curStep {
		case "xp":
			adminLoyaltyState.newXp[adminID] = v
			adminLoyaltyState.newStep[adminID] = "pct"
			adminLoyaltyState.mu.Unlock()
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID:    update.Message.Chat.ID,
				ParseMode: models.ParseModeHTML,
				Text:      h.translation.GetText(lang, "admin_loyalty_new_prompt_pct"),
			})
			return
		case "pct":
			xpMin := adminLoyaltyState.newXp[adminID]
			pct := int(v)
			if pct < 0 {
				pct = 0
			}
			if pct > 100 {
				pct = 100
			}
			adminLoyaltyState.mu.Unlock()
			mx, err := h.loyaltyTierRepository.MaxSortOrder(ctx)
			if err != nil {
				slog.Error("admin loyalty max sort", "error", err)
				adminLoyaltyClear(adminID)
				return
			}
			nextOrder := mx + 1
			if _, err := h.loyaltyTierRepository.Insert(ctx, nextOrder, xpMin, pct, nil); err != nil {
				slog.Error("admin loyalty insert", "error", err)
				adminLoyaltyClear(adminID)
				return
			}
			adminLoyaltyClear(adminID)
			msg, err := b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID:    update.Message.Chat.ID,
				ParseMode: models.ParseModeHTML,
				Text:      h.translation.GetText(lang, "admin_loyalty_level_created"),
			})
			if err != nil || msg == nil {
				return
			}
			_ = h.adminLoyaltyLevelsEdit(ctx, b, update.Message.Chat.ID, int64(msg.ID), lang)
			return
		default:
			adminLoyaltyState.mu.Unlock()
		}
	}
}
