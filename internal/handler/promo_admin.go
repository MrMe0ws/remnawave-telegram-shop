package handler

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/promo"
)

const promoPageSize = 5

type adminPromoEditState struct {
	PromoID     int64
	Field       string // "vald" | "maxu" | "subd" | "trd"
	ChatID      int64
	PromptMsgID int
}

var adminPromoEdit = struct {
	mu      sync.Mutex
	pending map[int64]*adminPromoEditState
}{pending: make(map[int64]*adminPromoEditState)}

func adminPromoEditClear(adminID int64) {
	adminPromoEdit.mu.Lock()
	delete(adminPromoEdit.pending, adminID)
	adminPromoEdit.mu.Unlock()
}

// AdminPromoEditWaiting is true while the admin is entering a value for promo edit.
func AdminPromoEditWaiting(adminID int64) bool {
	adminPromoEdit.mu.Lock()
	defer adminPromoEdit.mu.Unlock()
	_, ok := adminPromoEdit.pending[adminID]
	return ok
}

type adminPromoDraft struct {
	Type          string
	Code          string
	SubDays       int
	TrialDays     int
	ExtraHwid     int
	DiscountPct   int
	MaxUses       int
	ValidDays     int
	DiscountHours int
}

var adminPromoWizard = struct {
	mu    sync.Mutex
	step  map[int64]string
	draft map[int64]*adminPromoDraft
}{
	step:  make(map[int64]string),
	draft: make(map[int64]*adminPromoDraft),
}

func adminPromoWizardOnlyReset(adminID int64) {
	adminPromoWizard.mu.Lock()
	defer adminPromoWizard.mu.Unlock()
	delete(adminPromoWizard.step, adminID)
	delete(adminPromoWizard.draft, adminID)
}

func adminPromoReset(adminID int64) {
	adminPromoWizardOnlyReset(adminID)
	adminPromoEditClear(adminID)
}

// AdminPromoWaiting is true while the admin is in the promo creation wizard.
func AdminPromoWaiting(adminID int64) bool {
	adminPromoWizard.mu.Lock()
	defer adminPromoWizard.mu.Unlock()
	_, ok := adminPromoWizard.step[adminID]
	return ok
}

func promoTypeIcon(t string) string {
	switch t {
	case database.PromoTypeTrial:
		return "🎁"
	case database.PromoTypeExtraHwid:
		return "📱"
	case database.PromoTypeDiscount:
		return "💸"
	default:
		return "📅"
	}
}

func (h Handler) promoTypeTitleLine(lang, t string) string {
	switch t {
	case database.PromoTypeSubscriptionDays:
		return h.translation.GetText(lang, "promo_type_title_days")
	case database.PromoTypeTrial:
		return h.translation.GetText(lang, "promo_type_title_trial")
	case database.PromoTypeExtraHwid:
		return h.translation.GetText(lang, "promo_type_title_hwid")
	case database.PromoTypeDiscount:
		return h.translation.GetText(lang, "promo_type_title_discount")
	default:
		return ""
	}
}

func formatPromoUsesLine(p *database.PromoCode) string {
	if p.MaxUses != nil && *p.MaxUses > 0 {
		return fmt.Sprintf("%d/%d", p.UsesCount, *p.MaxUses)
	}
	return fmt.Sprintf("%d/∞", p.UsesCount)
}

func (h Handler) formatPromoValidUntil(p *database.PromoCode, lang string) string {
	if p.ValidUntil == nil {
		return h.translation.GetText(lang, "promo_unlimited")
	}
	return p.ValidUntil.Format("02.01.2006 15:04")
}

func (h Handler) formatDiscountExtraLine(p *database.PromoCode, lang string) string {
	if p.Type != database.PromoTypeDiscount || p.DiscountPercent == nil {
		return ""
	}
	pct := *p.DiscountPercent
	if p.DiscountTTLHours == nil {
		return fmt.Sprintf(h.translation.GetText(lang, "promo_line_discount_plain"), pct)
	}
	hh := *p.DiscountTTLHours
	if hh == 0 {
		return fmt.Sprintf(h.translation.GetText(lang, "promo_line_discount_firstpay"), pct)
	}
	return fmt.Sprintf(h.translation.GetText(lang, "promo_line_discount_hours"), pct, hh)
}

func (h Handler) formatCardDiscountLine(p *database.PromoCode, lang string) string {
	if p.Type != database.PromoTypeDiscount || p.DiscountPercent == nil {
		return ""
	}
	pct := *p.DiscountPercent
	if p.DiscountTTLHours == nil {
		return fmt.Sprintf(h.translation.GetText(lang, "promo_card_discount_plain"), pct)
	}
	hh := *p.DiscountTTLHours
	if hh == 0 {
		return fmt.Sprintf(h.translation.GetText(lang, "promo_card_discount_first"), pct)
	}
	return fmt.Sprintf(h.translation.GetText(lang, "promo_card_discount_hours"), pct, hh)
}

func (h Handler) promoLineSummary(p *database.PromoCode, lang string) string {
	active := "❌"
	if p.Active {
		active = "✅"
	}
	icon := promoTypeIcon(p.Type)
	uses := formatPromoUsesLine(p)
	until := h.formatPromoValidUntil(p, lang)
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s %s <b>%s</b>\n", active, icon, p.Code))
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_line_uses"), uses))
	sb.WriteString("\n")
	switch p.Type {
	case database.PromoTypeSubscriptionDays:
		if p.SubscriptionDays != nil {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_line_sub_days"), *p.SubscriptionDays))
			sb.WriteString("\n")
		}
	case database.PromoTypeTrial:
		if p.TrialDays != nil {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_line_trial_days"), *p.TrialDays))
			sb.WriteString("\n")
		}
	case database.PromoTypeExtraHwid:
		if p.ExtraHwidDelta != nil {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_line_hwid_n"), *p.ExtraHwidDelta))
			sb.WriteString("\n")
		}
	case database.PromoTypeDiscount:
		sb.WriteString(h.formatDiscountExtraLine(p, lang))
		sb.WriteString("\n")
	}
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_line_until"), until))
	return sb.String()
}

// AdminPromoOpenHandler opens promo management root (from admin panel).
func (h Handler) AdminPromoOpenHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	h.renderPromoRoot(ctx, b, update.CallbackQuery)
}

// PromoRootHandler callback promo_root
func (h Handler) PromoRootHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	adminPromoReset(update.CallbackQuery.From.ID)
	h.renderPromoRoot(ctx, b, update.CallbackQuery)
}

func (h Handler) renderPromoRoot(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery) {
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	total, active, inactive, err := h.promoRepository.CountTotals(ctx)
	if err != nil {
		slog.Error("promo totals", "error", err)
		return
	}
	text := fmt.Sprintf(h.translation.GetText(lang, "promo_admin_root"), total, active, inactive)
	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "promo_admin_list", models.InlineKeyboardButton{CallbackData: CallbackPromoList + "?p=0"}),
			h.translation.WithButton(lang, "promo_admin_create", models.InlineKeyboardButton{CallbackData: CallbackPromoNew}),
		},
		{h.translation.WithButton(lang, "promo_admin_stats_all", models.InlineKeyboardButton{CallbackData: CallbackPromoStatsAll})},
		{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel})},
	}
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("promo root edit", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// renderPromoListPage редактирует сообщение: список промокодов (без AnswerCallbackQuery).
func (h Handler) renderPromoListPage(ctx context.Context, b *bot.Bot, chatID int64, messageID int, page int, lang string) error {
	list, total, err := h.promoRepository.List(ctx, page*promoPageSize, promoPageSize)
	if err != nil {
		return err
	}
	pages := (total + promoPageSize - 1) / promoPageSize
	if pages == 0 {
		pages = 1
	}
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_admin_list_title"), page+1, pages))
	sb.WriteString("\n\n")
	for _, p := range list {
		line := h.promoLineSummary(&p, lang)
		sb.WriteString(line)
		sb.WriteString("\n\n")
	}
	var rows [][]models.InlineKeyboardButton
	for _, p := range list {
		rows = append(rows, []models.InlineKeyboardButton{
			{Text: p.Code, CallbackData: CallbackPromoCard + "?id=" + strconv.FormatInt(p.ID, 10)},
		})
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "promo_admin_create", models.InlineKeyboardButton{CallbackData: CallbackPromoNew}),
	})
	var navRow []models.InlineKeyboardButton
	if page > 0 {
		navRow = append(navRow, models.InlineKeyboardButton{Text: "«", CallbackData: CallbackPromoList + "?p=" + strconv.Itoa(page-1)})
	}
	if (page+1)*promoPageSize < total {
		navRow = append(navRow, models.InlineKeyboardButton{Text: "»", CallbackData: CallbackPromoList + "?p=" + strconv.Itoa(page+1)})
	}
	if len(navRow) > 0 {
		rows = append(rows, navRow)
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackPromoRoot}),
	})
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      chatID,
		MessageID:   messageID,
		ParseMode:   models.ParseModeHTML,
		Text:        sb.String(),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: rows},
	})
	return err
}

// PromoListHandler prefix promo_list?p=
func (h Handler) PromoListHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	q := parseCallbackData(cb.Data)
	page := parseIntSafe(q["p"])
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if err := h.renderPromoListPage(ctx, b, msg.Chat.ID, msg.ID, page, lang); err != nil {
		slog.Error("promo list edit", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// PromoCardHandler promo_card?id=
func (h Handler) PromoCardHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	if id == 0 {
		return
	}
	p, err := h.promoRepository.FindByID(ctx, id)
	if err != nil || p == nil {
		return
	}
	h.showPromoCard(ctx, b, cb, p, true)
}

func (h Handler) buildPromoCardText(p *database.PromoCode, lang string) string {
	fp := "❌"
	if p.FirstPurchaseOnly {
		fp = "✅"
	}
	until := h.formatPromoValidUntil(p, lang)
	var sb strings.Builder
	sb.WriteString(h.translation.GetText(lang, "promo_card_manage_title"))
	sb.WriteString("\n\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_code_line"), promoTypeIcon(p.Type), p.Code))
	sb.WriteString("\n")
	if p.Active {
		sb.WriteString(h.translation.GetText(lang, "promo_card_status_active_line"))
	} else {
		sb.WriteString(h.translation.GetText(lang, "promo_card_status_inactive_line"))
	}
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_uses_line"), formatPromoUsesLine(p)))
	sb.WriteString("\n")
	switch p.Type {
	case database.PromoTypeSubscriptionDays:
		if p.SubscriptionDays != nil {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_sub_days"), *p.SubscriptionDays))
			sb.WriteString("\n")
		}
	case database.PromoTypeTrial:
		if p.TrialDays != nil {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_trial_days"), *p.TrialDays))
			sb.WriteString("\n")
		}
	case database.PromoTypeExtraHwid:
		if p.ExtraHwidDelta != nil {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_hwid_n"), *p.ExtraHwidDelta))
			sb.WriteString("\n")
		}
	case database.PromoTypeDiscount:
		sb.WriteString(h.formatCardDiscountLine(p, lang))
		sb.WriteString("\n")
	}
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_until_line"), until))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_fp_line"), fp))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_card_created_line"), p.CreatedAt.Format("02.01.2006 15:04")))
	return sb.String()
}

func (h Handler) showPromoCard(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery, p *database.PromoCode, answerCallback bool) {
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	id := p.ID
	text := h.buildPromoCardText(p, lang)

	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "promo_btn_edit", models.InlineKeyboardButton{CallbackData: CallbackPromoEdit + "?id=" + strconv.FormatInt(id, 10)}),
			h.translation.WithButton(lang, "promo_btn_toggle", models.InlineKeyboardButton{CallbackData: CallbackPromoToggle + "?id=" + strconv.FormatInt(id, 10)}),
		},
		{h.translation.WithButton(lang, "promo_btn_first_purchase", models.InlineKeyboardButton{CallbackData: CallbackPromoFirstPur + "?id=" + strconv.FormatInt(id, 10)})},
		{
			h.translation.WithButton(lang, "promo_admin_stat", models.InlineKeyboardButton{CallbackData: CallbackPromoStat + "?id=" + strconv.FormatInt(id, 10)}),
			h.translation.WithButton(lang, "promo_admin_delete", models.InlineKeyboardButton{CallbackData: CallbackPromoDel + "?id=" + strconv.FormatInt(id, 10)}),
		},
		{h.translation.WithButton(lang, "promo_to_list", models.InlineKeyboardButton{CallbackData: CallbackPromoList + "?p=0"})},
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("promo card", "error", err)
	}
	if answerCallback {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
	}
}

// PromoToggleHandler
func (h Handler) PromoToggleHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	p, err := h.promoRepository.FindByID(ctx, id)
	if err != nil || p == nil {
		return
	}
	_ = h.promoRepository.UpdateFields(ctx, id, map[string]interface{}{"active": !p.Active})
	p, _ = h.promoRepository.FindByID(ctx, id)
	if p == nil {
		return
	}
	var alert string
	if p.Active {
		alert = h.translation.GetText(lang, "promo_alert_activated")
	} else {
		alert = h.translation.GetText(lang, "promo_alert_deactivated")
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            alert,
		ShowAlert:       true,
	})
	h.showPromoCard(ctx, b, cb, p, false)
}

// PromoFirstPurchaseToggle
func (h Handler) PromoFirstPurchaseToggle(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	p, err := h.promoRepository.FindByID(ctx, id)
	if err != nil || p == nil {
		return
	}
	_ = h.promoRepository.UpdateFields(ctx, id, map[string]interface{}{"first_purchase_only": !p.FirstPurchaseOnly})
	p, _ = h.promoRepository.FindByID(ctx, id)
	if p == nil {
		return
	}
	var alert string
	if p.FirstPurchaseOnly {
		alert = h.translation.GetText(lang, "promo_alert_fp_on")
	} else {
		alert = h.translation.GetText(lang, "promo_alert_fp_off")
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            alert,
		ShowAlert:       true,
	})
	h.showPromoCard(ctx, b, cb, p, false)
}

// PromoStatHandler
func (h Handler) PromoStatHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	n, err := h.promoRepository.CountRedemptions(ctx, id)
	if err != nil {
		return
	}
	today, _ := h.promoRepository.CountRedemptionsToday(ctx, id)
	p, _ := h.promoRepository.FindByID(ctx, id)
	if p == nil {
		return
	}
	left := "∞"
	if p.MaxUses != nil && *p.MaxUses > 0 {
		left = strconv.Itoa(*p.MaxUses - p.UsesCount)
	}
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	recent, _ := h.promoRepository.ListRecentRedemptions(ctx, id, 12)
	var recentSb strings.Builder
	if len(recent) == 0 {
		recentSb.WriteString(h.translation.GetText(lang, "promo_stat_no_recent"))
	} else {
		for _, r := range recent {
			name := getReferralDisplayName(ctx, b, r.TelegramID)
			recentSb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_stat_recent_line"), r.UsedAt.Format("02.01.2006 15:04"), name))
			recentSb.WriteString("\n")
		}
	}
	text := fmt.Sprintf(h.translation.GetText(lang, "promo_stat_body_v2"), p.Code, n, today, left, recentSb.String())
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    msg.Chat.ID,
		MessageID: msg.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackPromoCard + "?id=" + strconv.FormatInt(id, 10)})},
		}},
	})
	if err != nil {
		slog.Error("promo stat", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// PromoStatsAllHandler
func (h Handler) PromoStatsAllHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	total, active, inactive, err := h.promoRepository.CountTotals(ctx)
	if err != nil {
		return
	}
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	text := fmt.Sprintf(h.translation.GetText(lang, "promo_stats_all_body_v2"), total, active, inactive)
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    msg.Chat.ID,
		MessageID: msg.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "promo_to_root", models.InlineKeyboardButton{CallbackData: CallbackPromoList + "?p=0"})},
			{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel})},
		}},
	})
	if err != nil {
		slog.Error("promo stats all", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// PromoDeleteAskHandler
func (h Handler) PromoDeleteAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	p, _ := h.promoRepository.FindByID(ctx, id)
	if p == nil {
		return
	}
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	st := h.translation.GetText(lang, "promo_status_label_active")
	if !p.Active {
		st = h.translation.GetText(lang, "promo_status_label_inactive")
	}
	text := fmt.Sprintf(h.translation.GetText(lang, "promo_delete_confirm_v2"), p.Code, formatPromoUsesLine(p), st, id)
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    msg.Chat.ID,
		MessageID: msg.ID,
		ParseMode: models.ParseModeHTML,
		Text:      text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "promo_delete_yes", models.InlineKeyboardButton{CallbackData: CallbackPromoDelYes + "?id=" + strconv.FormatInt(id, 10)})},
			{h.translation.WithButton(lang, "promo_delete_cancel", models.InlineKeyboardButton{CallbackData: CallbackPromoCard + "?id=" + strconv.FormatInt(id, 10)})},
		}},
	})
	if err != nil {
		slog.Error("promo del ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// PromoDeleteYesHandler
func (h Handler) PromoDeleteYesHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	if err := h.promoRepository.Delete(ctx, id); err != nil {
		slog.Error("promo delete", "error", err)
		return
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "promo_deleted_alert"),
		ShowAlert:       true,
	})
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	if err := h.renderPromoListPage(ctx, b, msg.Chat.ID, msg.ID, 0, lang); err != nil {
		slog.Error("promo list after delete", "error", err)
	}
}

// PromoNewMenuHandler — choose type
func (h Handler) PromoNewMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	adminPromoReset(cb.From.ID)
	adminPromoWizard.mu.Lock()
	adminPromoWizard.draft[cb.From.ID] = &adminPromoDraft{}
	adminPromoWizard.mu.Unlock()

	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "promo_type_days", models.InlineKeyboardButton{CallbackData: CallbackPromoNewType + "?t=sd"}),
			h.translation.WithButton(lang, "promo_type_trial", models.InlineKeyboardButton{CallbackData: CallbackPromoNewType + "?t=tr"}),
		},
		{
			h.translation.WithButton(lang, "promo_type_hwid", models.InlineKeyboardButton{CallbackData: CallbackPromoNewType + "?t=eh"}),
			h.translation.WithButton(lang, "promo_type_discount", models.InlineKeyboardButton{CallbackData: CallbackPromoNewType + "?t=di"}),
		},
		{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackPromoRoot})},
	}
	title := h.translation.GetText(lang, "promo_new_title")
	choose := h.translation.GetText(lang, "promo_new_choose_type")
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        title + "\n\n" + choose,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("promo new menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// PromoNewTypeHandler sets type and asks for code via next message
func (h Handler) PromoNewTypeHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	t := parseCallbackData(cb.Data)["t"]
	lang := cb.From.LanguageCode
	msg := cb.Message.Message

	adminPromoWizard.mu.Lock()
	d := adminPromoWizard.draft[cb.From.ID]
	if d == nil {
		d = &adminPromoDraft{}
		adminPromoWizard.draft[cb.From.ID] = d
	}
	switch t {
	case "sd":
		d.Type = database.PromoTypeSubscriptionDays
	case "tr":
		d.Type = database.PromoTypeTrial
	case "eh":
		d.Type = database.PromoTypeExtraHwid
	case "di":
		d.Type = database.PromoTypeDiscount
	default:
		adminPromoWizard.mu.Unlock()
		return
	}
	adminPromoWizard.step[cb.From.ID] = "code"
	adminPromoWizard.mu.Unlock()

	title := h.translation.GetText(lang, "promo_new_title")
	typeLine := h.promoTypeTitleLine(lang, d.Type)
	body := h.translation.GetText(lang, "promo_wizard_code_body")
	screen := title + "\n\n" + typeLine + "\n\n" + body
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    msg.Chat.ID,
		MessageID: msg.ID,
		ParseMode: models.ParseModeHTML,
		Text:      screen,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "promo_wizard_cancel", models.InlineKeyboardButton{CallbackData: CallbackPromoRoot})},
		}},
	})
	if err != nil {
		slog.Error("promo type", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// AdminPromoTextHandler processes wizard steps (registered before BroadcastMessageHandler).
func (h Handler) AdminPromoTextHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil || h.promoRepository == nil {
		return
	}
	adminID := config.GetAdminTelegramId()
	if update.Message.From.ID != adminID || update.Message.ReplyToMessage != nil {
		return
	}
	if AdminPromoEditWaiting(adminID) {
		h.handlePromoEditText(ctx, b, update)
		return
	}
	if h.promoService == nil {
		return
	}
	if !AdminPromoWaiting(adminID) {
		return
	}
	text := strings.TrimSpace(update.Message.Text)
	lang := "ru"
	if update.Message.From.LanguageCode != "" {
		lang = update.Message.From.LanguageCode
	}

	adminPromoWizard.mu.Lock()
	step := adminPromoWizard.step[adminID]
	d := adminPromoWizard.draft[adminID]
	adminPromoWizard.mu.Unlock()
	if d == nil || step == "" {
		adminPromoReset(adminID)
		return
	}

	switch step {
	case "code":
		if !promo.ValidCodePattern(text) {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_code")})
			return
		}
		code := promo.NormalizeCode(text)
		if existing, _ := h.promoRepository.FindByCode(ctx, code); existing != nil {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_code_exists")})
			return
		}
		d.Code = code
		adminPromoWizard.mu.Lock()
		adminPromoWizard.step[adminID] = nextNumStep(d.Type)
		adminPromoWizard.mu.Unlock()
		ack := fmt.Sprintf(h.translation.GetText(lang, "promo_wizard_code_ack"), promoTypeIcon(d.Type), code)
		combined := ack + "\n\n" + nextNumPrompt(d.Type, lang, h)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    adminID,
			ParseMode: models.ParseModeHTML,
			Text:      combined,
			ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
				{h.translation.WithButton(lang, "promo_wizard_cancel", models.InlineKeyboardButton{CallbackData: CallbackPromoRoot})},
			}},
		})
		return

	case "num1":
		n, err := strconv.Atoi(text)
		if err != nil || n <= 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		switch d.Type {
		case database.PromoTypeSubscriptionDays:
			d.SubDays = n
		case database.PromoTypeTrial:
			d.TrialDays = n
		case database.PromoTypeExtraHwid:
			d.ExtraHwid = n
		case database.PromoTypeDiscount:
			if n < 1 || n > 100 {
				_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
				return
			}
			d.DiscountPct = n
		}
		if d.Type == database.PromoTypeDiscount {
			adminPromoWizard.mu.Lock()
			adminPromoWizard.step[adminID] = "maxu"
			adminPromoWizard.mu.Unlock()
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_wizard_max_uses")})
			return
		}
		adminPromoWizard.mu.Lock()
		adminPromoWizard.step[adminID] = "maxu"
		adminPromoWizard.mu.Unlock()
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_wizard_max_uses")})
		return

	case "maxu":
		n, err := strconv.Atoi(text)
		if err != nil || n < 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		d.MaxUses = n
		adminPromoWizard.mu.Lock()
		adminPromoWizard.step[adminID] = "vald"
		adminPromoWizard.mu.Unlock()
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_wizard_valid_days")})
		return

	case "vald":
		n, err := strconv.Atoi(text)
		if err != nil || n < 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		d.ValidDays = n
		if d.Type != database.PromoTypeDiscount {
			h.finalizePromoCreate(ctx, b, adminID, lang, d)
			return
		}
		adminPromoWizard.mu.Lock()
		adminPromoWizard.step[adminID] = "dish"
		adminPromoWizard.mu.Unlock()
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_wizard_disc_hours")})
		return

	case "dish":
		n, err := strconv.Atoi(text)
		if err != nil || n < 0 || n > 8760 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		d.DiscountHours = n
		h.finalizePromoCreate(ctx, b, adminID, lang, d)
		return
	}
}

func nextNumStep(t string) string {
	return "num1"
}

func nextNumPrompt(t string, lang string, h Handler) string {
	switch t {
	case database.PromoTypeSubscriptionDays:
		return h.translation.GetText(lang, "promo_wizard_sub_days")
	case database.PromoTypeTrial:
		return h.translation.GetText(lang, "promo_wizard_trial_days")
	case database.PromoTypeExtraHwid:
		return h.translation.GetText(lang, "promo_wizard_hwid")
	case database.PromoTypeDiscount:
		return h.translation.GetText(lang, "promo_wizard_disc_pct")
	}
	return ""
}

func (h Handler) finalizePromoCreate(ctx context.Context, b *bot.Bot, adminID int64, lang string, d *adminPromoDraft) {
	var validUntil *time.Time
	if d.ValidDays > 0 {
		t := time.Now().UTC().AddDate(0, 0, d.ValidDays)
		validUntil = &t
	}
	var maxUses *int
	if d.MaxUses > 0 {
		maxUses = &d.MaxUses
	}
	pc := &database.PromoCode{
		Code:                     d.Code,
		Type:                     d.Type,
		Active:                   true,
		FirstPurchaseOnly:        false,
		RequireCustomerInDB:      false,
		AllowTrialWithoutPayment: true,
		ValidUntil:               validUntil,
		MaxUses:                  maxUses,
		UsesCount:                0,
	}
	switch d.Type {
	case database.PromoTypeSubscriptionDays:
		sd := d.SubDays
		pc.SubscriptionDays = &sd
	case database.PromoTypeTrial:
		td := d.TrialDays
		pc.TrialDays = &td
	case database.PromoTypeExtraHwid:
		eh := d.ExtraHwid
		pc.ExtraHwidDelta = &eh
	case database.PromoTypeDiscount:
		dp := d.DiscountPct
		pc.DiscountPercent = &dp
		dh := d.DiscountHours
		pc.DiscountTTLHours = &dh
	}
	_, err := h.promoRepository.Create(ctx, pc)
	if err != nil {
		slog.Error("promo create", "error", err)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_create_err")})
		adminPromoReset(adminID)
		return
	}
	summary := h.formatPromoSuccessSummary(lang, d, validUntil, maxUses)
	kb := models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "promo_to_root", models.InlineKeyboardButton{CallbackData: CallbackPromoList + "?p=0"})},
	}}
	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      adminID,
		ParseMode:   models.ParseModeHTML,
		Text:        summary,
		ReplyMarkup: kb,
	})
	adminPromoReset(adminID)
}

func (h Handler) formatPromoSuccessSummary(lang string, d *adminPromoDraft, validUntil *time.Time, maxUses *int) string {
	untilStr := h.translation.GetText(lang, "promo_unlimited")
	if validUntil != nil {
		untilStr = validUntil.Format("02.01.2006 15:04")
	}
	usesStr := "0/∞"
	if maxUses != nil {
		usesStr = fmt.Sprintf("0/%d", *maxUses)
	}
	typeTitle := h.promoTypeTitleLine(lang, d.Type)
	var sb strings.Builder
	sb.WriteString(h.translation.GetText(lang, "promo_create_ok_header"))
	sb.WriteString("\n\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_code"), d.Code))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_type"), typeTitle))
	sb.WriteString("\n")
	switch d.Type {
	case database.PromoTypeSubscriptionDays:
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_sub_days"), d.SubDays))
	case database.PromoTypeTrial:
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_trial_days"), d.TrialDays))
	case database.PromoTypeExtraHwid:
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_hwid"), d.ExtraHwid))
	case database.PromoTypeDiscount:
		sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_disc_pct"), d.DiscountPct))
		sb.WriteString("\n")
		if d.DiscountHours > 0 {
			sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_disc_h"), d.DiscountHours))
		} else {
			sb.WriteString(h.translation.GetText(lang, "promo_success_disc_first"))
		}
	}
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_uses_line"), usesStr))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf(h.translation.GetText(lang, "promo_success_until"), untilStr))
	return sb.String()
}

func (h Handler) handlePromoEditText(ctx context.Context, b *bot.Bot, update *models.Update) {
	adminID := update.Message.From.ID
	text := strings.TrimSpace(update.Message.Text)
	lang := "ru"
	if update.Message.From.LanguageCode != "" {
		lang = update.Message.From.LanguageCode
	}
	adminPromoEdit.mu.Lock()
	st := adminPromoEdit.pending[adminID]
	adminPromoEdit.mu.Unlock()
	if st == nil {
		return
	}
	chatID := st.ChatID
	msgID := st.PromptMsgID
	savedKb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "promo_edit_back_to_card", models.InlineKeyboardButton{CallbackData: CallbackPromoCard + "?id=" + strconv.FormatInt(st.PromoID, 10)})},
	}
	savedText := h.translation.GetText(lang, "promo_edit_saved")
	switch st.Field {
	case "vald":
		n, err := strconv.Atoi(text)
		if err != nil || n < 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		var vu interface{}
		if n > 0 {
			t := time.Now().UTC().AddDate(0, 0, n)
			vu = &t
		} else {
			vu = nil
		}
		if err := h.promoRepository.UpdateFields(ctx, st.PromoID, map[string]interface{}{"valid_until": vu}); err != nil {
			slog.Error("promo edit valid_until", "error", err)
			return
		}
		adminPromoEditClear(adminID)
		_, _ = b.EditMessageText(ctx, &bot.EditMessageTextParams{
			ChatID:      chatID,
			MessageID:   msgID,
			ParseMode:   models.ParseModeHTML,
			Text:        savedText,
			ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: savedKb},
		})
	case "maxu":
		n, err := strconv.Atoi(text)
		if err != nil || n < 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		var mu interface{}
		if n > 0 {
			mu = &n
		} else {
			mu = nil
		}
		if err := h.promoRepository.UpdateFields(ctx, st.PromoID, map[string]interface{}{"max_uses": mu}); err != nil {
			slog.Error("promo edit max_uses", "error", err)
			return
		}
		adminPromoEditClear(adminID)
		_, _ = b.EditMessageText(ctx, &bot.EditMessageTextParams{
			ChatID:      chatID,
			MessageID:   msgID,
			ParseMode:   models.ParseModeHTML,
			Text:        savedText,
			ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: savedKb},
		})
	case "subd":
		n, err := strconv.Atoi(text)
		if err != nil || n <= 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		if err := h.promoRepository.UpdateFields(ctx, st.PromoID, map[string]interface{}{"subscription_days": n}); err != nil {
			slog.Error("promo edit subscription_days", "error", err)
			return
		}
		adminPromoEditClear(adminID)
		_, _ = b.EditMessageText(ctx, &bot.EditMessageTextParams{
			ChatID:      chatID,
			MessageID:   msgID,
			ParseMode:   models.ParseModeHTML,
			Text:        savedText,
			ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: savedKb},
		})
	case "trd":
		n, err := strconv.Atoi(text)
		if err != nil || n <= 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{ChatID: adminID, Text: h.translation.GetText(lang, "promo_bad_number")})
			return
		}
		if err := h.promoRepository.UpdateFields(ctx, st.PromoID, map[string]interface{}{"trial_days": n}); err != nil {
			slog.Error("promo edit trial_days", "error", err)
			return
		}
		adminPromoEditClear(adminID)
		_, _ = b.EditMessageText(ctx, &bot.EditMessageTextParams{
			ChatID:      chatID,
			MessageID:   msgID,
			ParseMode:   models.ParseModeHTML,
			Text:        savedText,
			ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: savedKb},
		})
	}
}

// PromoEditMenuHandler — параметры промокода для правки.
func (h Handler) PromoEditMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	p, err := h.promoRepository.FindByID(ctx, id)
	if err != nil || p == nil {
		return
	}
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	adminPromoReset(cb.From.ID)
	uses := formatPromoUsesLine(p)
	until := h.formatPromoValidUntil(p, lang)
	text := fmt.Sprintf(h.translation.GetText(lang, "promo_edit_menu"), p.Code, uses, until)
	var kb [][]models.InlineKeyboardButton
	kb = append(kb, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "promo_edit_valid_until", models.InlineKeyboardButton{CallbackData: CallbackPromoEditValid + "?id=" + strconv.FormatInt(id, 10)}),
	})
	switch p.Type {
	case database.PromoTypeSubscriptionDays:
		kb = append(kb, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "promo_edit_sub_days_btn", models.InlineKeyboardButton{CallbackData: CallbackPromoEditSubDays + "?id=" + strconv.FormatInt(id, 10)}),
		})
	case database.PromoTypeTrial:
		kb = append(kb, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "promo_edit_trial_days_btn", models.InlineKeyboardButton{CallbackData: CallbackPromoEditTrialDays + "?id=" + strconv.FormatInt(id, 10)}),
		})
	}
	kb = append(kb, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "promo_edit_max_uses_btn", models.InlineKeyboardButton{CallbackData: CallbackPromoEditMax + "?id=" + strconv.FormatInt(id, 10)}),
	})
	kb = append(kb, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackPromoCard + "?id=" + strconv.FormatInt(id, 10)}),
	})
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("promo edit menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) promoEditShowPrompt(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery, id int64, field string, body string) {
	adminID := cb.From.ID
	msg := cb.Message.Message
	adminPromoWizardOnlyReset(adminID)
	adminPromoEdit.mu.Lock()
	adminPromoEdit.pending[adminID] = &adminPromoEditState{
		PromoID: id, Field: field, ChatID: msg.Chat.ID, PromptMsgID: msg.ID,
	}
	adminPromoEdit.mu.Unlock()
	lang := cb.From.LanguageCode
	kb := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "promo_edit_cancel_btn", models.InlineKeyboardButton{CallbackData: CallbackPromoEdit + "?id=" + strconv.FormatInt(id, 10)})},
	}
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        body,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kb},
	})
	if err != nil {
		slog.Error("promo edit prompt", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// PromoEditAskValidHandler — ввод срока действия (дней от сегодня, 0 = бессрочно).
func (h Handler) PromoEditAskValidHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	lang := cb.From.LanguageCode
	body := fmt.Sprintf(h.translation.GetText(lang, "promo_edit_prompt_valid_v2"), id)
	h.promoEditShowPrompt(ctx, b, cb, id, "vald", body)
}

// PromoEditAskMaxHandler — количество использований (0 = безлимит).
func (h Handler) PromoEditAskMaxHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	lang := cb.From.LanguageCode
	body := fmt.Sprintf(h.translation.GetText(lang, "promo_edit_prompt_max_v2"), id)
	h.promoEditShowPrompt(ctx, b, cb, id, "maxu", body)
}

// PromoEditAskSubDaysHandler — дни подписки (тип «дни подписки»).
func (h Handler) PromoEditAskSubDaysHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	lang := cb.From.LanguageCode
	body := fmt.Sprintf(h.translation.GetText(lang, "promo_edit_prompt_sub_days_v2"), id)
	h.promoEditShowPrompt(ctx, b, cb, id, "subd", body)
}

// PromoEditAskTrialDaysHandler — дни триала.
func (h Handler) PromoEditAskTrialDaysHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() || h.promoRepository == nil {
		return
	}
	cb := update.CallbackQuery
	id, _ := strconv.ParseInt(parseCallbackData(cb.Data)["id"], 10, 64)
	lang := cb.From.LanguageCode
	body := fmt.Sprintf(h.translation.GetText(lang, "promo_edit_prompt_trial_days_v2"), id)
	h.promoEditShowPrompt(ctx, b, cb, id, "trd", body)
}
