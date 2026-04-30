package handler

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"github.com/google/uuid"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/payment"
	"remnawave-tg-shop-bot/internal/remnawave"
)

var adminPanelStrategies = []string{"DAY", "WEEK", "MONTH", "MONTH_ROLLING", "NO_RESET"}

func trafficLimitPresetsGB() []int64 {
	return []int64{5, 10, 50, 100, 500}
}

func gbToBytes(gb int64) int64 {
	return gb * 1024 * 1024 * 1024
}

func formatTrafficLimitGB(bytes int64) string {
	if bytes <= 0 {
		return "—"
	}
	gb := float64(bytes) / float64(1024*1024*1024)
	s := strconv.FormatFloat(gb, 'f', 3, 64)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	if s == "" {
		s = "0"
	}
	return s + " GB"
}

func parseCIDIndex(prefix, data string) (cid int64, idx int, ok bool) {
	if !strings.HasPrefix(data, prefix) {
		return 0, 0, false
	}
	rest := strings.TrimPrefix(data, prefix)
	pos := strings.LastIndex(rest, "_")
	if pos <= 0 || pos >= len(rest)-1 {
		return 0, 0, false
	}
	var err error
	cid, err = strconv.ParseInt(rest[:pos], 10, 64)
	if err != nil || cid <= 0 {
		return 0, 0, false
	}
	idx, err = strconv.Atoi(rest[pos+1:])
	if err != nil || idx < 0 {
		return 0, 0, false
	}
	return cid, idx, true
}

func (h Handler) adminSyncCustomerAfterPatch(ctx context.Context, custID int64, out *remnawave.User) error {
	return h.customerRepository.UpdateFields(ctx, custID, map[string]interface{}{
		"subscription_link": out.SubscriptionUrl,
		"expire_at":         out.ExpireAt,
	})
}

// --- Корень расширенных настроек Remnawave ------------------------------------

func (h Handler) AdminUserPanelMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserPanelMenuPrefix)
	if !ok {
		return
	}
	adminTrafficLimitClear(cb.From.ID)
	adminUserDescriptionClear(cb.From.ID)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.adminUserSubscriptionScreenHTML(ctx, b, lang, cust)
	kb := h.adminUserSubscriptionSubmenuKeyboard(ctx, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin panel menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

// Меню сквадов: asl{id}. Переключение: asq{id}_{idx}

func (h Handler) renderAdminSquadMenu(ctx context.Context, b *bot.Bot, msg *models.Message, cid int64, lang string) error {
	squads, err := h.remnawaveClient.ListInternalSquads(ctx)
	if err != nil {
		return err
	}
	if len(squads) == 0 {
		kb := [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
			})},
		}
		_, err = editCallbackOriginToHTMLText(ctx, b, msg, h.translation.GetText(lang, "admin_user_panel_no_squads"),
			models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
		return err
	}

	_, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		kb := [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
			})},
		}
		_, err = editCallbackOriginToHTMLText(ctx, b, msg, h.translation.GetText(lang, "admin_user_cal_no_rw_user"),
			models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
		return err
	}
	selected := make(map[uuid.UUID]struct{})
	for _, s := range rw.ActiveInternalSquads {
		selected[s.UUID] = struct{}{}
	}

	text := h.translation.GetText(lang, "admin_user_panel_pick_squad")
	var rows [][]models.InlineKeyboardButton
	for i, sq := range squads {
		short := sq.Name
		prefix := "○ "
		if _, on := selected[sq.UUID]; on {
			prefix = "✓ "
		}
		label := prefix + short
		runes := []rune(label)
		if len(runes) > 58 {
			label = string(runes[:56]) + "…"
		}
		rows = append(rows, []models.InlineKeyboardButton{
			{Text: label, CallbackData: fmt.Sprintf("%s%d_%d", CallbackAdminUserSquadPickPrefix, cid, i)},
		})
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
		}),
	})
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: rows}, nil)
	return err
}

func (h Handler) AdminUserSquadMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserSquadMenuPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	if err := h.renderAdminSquadMenu(ctx, b, msg, cid, lang); err != nil {
		slog.Error("admin squad menu edit", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserSquadPickHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, idx, ok := parseCIDIndex(CallbackAdminUserSquadPickPrefix, cb.Data)
	if !ok {
		return
	}
	h.adminUserSquadToggle(ctx, b, cb, cid, idx)
}

func (h Handler) adminUserSquadToggle(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery, cid int64, squadIdx int) {
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	squads, err := h.remnawaveClient.ListInternalSquads(ctx)
	if err != nil || squadIdx < 0 || squadIdx >= len(squads) {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	toggled := squads[squadIdx].UUID

	cust, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_cal_no_rw_user"),
			ShowAlert:       true,
		})
		return
	}

	chosenSet := make(map[uuid.UUID]struct{})
	var order []uuid.UUID
	for _, s := range rw.ActiveInternalSquads {
		if _, dup := chosenSet[s.UUID]; dup {
			continue
		}
		chosenSet[s.UUID] = struct{}{}
		order = append(order, s.UUID)
	}
	if _, exists := chosenSet[toggled]; exists {
		next := order[:0]
		for _, u := range order {
			if u != toggled {
				next = append(next, u)
			}
		}
		order = next
	} else {
		order = append(order, toggled)
	}

	st := strings.TrimSpace(rw.Status)
	if st == "" {
		st = "ACTIVE"
	}
	squadsOrder := append([]uuid.UUID(nil), order...)
	req := &remnawave.UpdateUserRequest{
		UUID:                 &rw.UUID,
		Status:               st,
		ActiveInternalSquads: &squadsOrder,
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin squad patch", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin squad sync db", "error", err)
	}
	lang := cb.From.LanguageCode
	if err := h.renderAdminSquadMenu(ctx, b, msg, cid, lang); err != nil {
		slog.Error("admin squad refresh menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "admin_user_panel_saved"),
	})
}

func (h Handler) adminRwUserByCustomerID(ctx context.Context, cid int64) (*database.Customer, *remnawave.User, error) {
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return nil, nil, fmt.Errorf("no customer")
	}
	rw, err := h.remnawaveClient.GetUserTrafficInfo(ctx, cust.TelegramID)
	if err != nil || rw == nil {
		return cust, nil, fmt.Errorf("no rw")
	}
	return cust, rw, nil
}

// Стратегия --------------------------------------------------------------------

func (h Handler) AdminUserStrategyMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserStrategyMenuPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.translation.GetText(lang, "admin_user_panel_pick_strategy")
	var curStrat string
	if _, rw, err := h.adminRwUserByCustomerID(ctx, cid); err == nil && rw != nil {
		curStrat = strings.TrimSpace(rw.TrafficLimitStrategy)
		if curStrat != "" {
			text += fmt.Sprintf(h.translation.GetText(lang, "admin_user_panel_strategy_current"), curStrat)
		}
	}
	var rows [][]models.InlineKeyboardButton
	var row []models.InlineKeyboardButton
	for i, s := range adminPanelStrategies {
		btn := models.InlineKeyboardButton{
			Text:         s,
			CallbackData: fmt.Sprintf("%s%d_%d", CallbackAdminUserStrategySetPrefix, cid, i),
		}
		if curStrat != "" && curStrat == s {
			btn.Style = "primary"
		}
		row = append(row, btn)
		if len(row) == 2 || i == len(adminPanelStrategies)-1 {
			rows = append(rows, row)
			row = nil
		}
	}
	if len(row) > 0 {
		rows = append(rows, row)
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
		}),
	})
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: rows}, nil)
	if err != nil {
		slog.Error("admin strategy menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserStrategySetHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, idx, ok := parseCIDIndex(CallbackAdminUserStrategySetPrefix, cb.Data)
	if !ok {
		return
	}
	h.adminUserStrategyApply(ctx, b, cb, cid, idx)
}

func (h Handler) adminUserStrategyApply(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery, cid int64, stratIdx int) {
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	if stratIdx < 0 || stratIdx >= len(adminPanelStrategies) {
		return
	}
	strategy := adminPanelStrategies[stratIdx]
	cust, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_cal_no_rw_user"),
			ShowAlert:       true,
		})
		return
	}
	st := strings.TrimSpace(rw.Status)
	if st == "" {
		st = "ACTIVE"
	}
	req := &remnawave.UpdateUserRequest{
		UUID:                 &rw.UUID,
		Status:               st,
		TrafficLimitStrategy: strategy,
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin strategy patch", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin strategy sync", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	lang := cb.From.LanguageCode
	text, markup := h.adminUserManageContent(ctx, b, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, markup, nil)
	if err != nil {
		slog.Error("admin strategy refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "admin_user_panel_saved"),
	})
}

// Лимит трафика ----------------------------------------------------------------

func (h Handler) AdminUserTrafficMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserTrafficMenuPrefix)
	if !ok {
		return
	}
	adminTrafficLimitClear(cb.From.ID)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.translation.GetText(lang, "admin_user_panel_pick_traffic")
	var curBytes int64
	if _, rw, err := h.adminRwUserByCustomerID(ctx, cid); err == nil && rw != nil {
		curBytes = rw.TrafficLimitBytes
		if curBytes > 0 {
			text += fmt.Sprintf(h.translation.GetText(lang, "admin_user_panel_traffic_current"), formatTrafficLimitGB(curBytes))
		}
	}
	presets := trafficLimitPresetsGB()
	var rows [][]models.InlineKeyboardButton
	var row []models.InlineKeyboardButton
	for i, gb := range presets {
		btn := models.InlineKeyboardButton{
			Text:         fmt.Sprintf("%d GB", gb),
			CallbackData: fmt.Sprintf("%s%d_%d", CallbackAdminUserTrafficSetPrefix, cid, i),
		}
		if curBytes > 0 && gbToBytes(gb) == curBytes {
			btn.Style = "primary"
		}
		row = append(row, btn)
		if len(row) == 3 || i == len(presets)-1 {
			rows = append(rows, row)
			row = nil
		}
	}
	if len(row) > 0 {
		rows = append(rows, row)
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "admin_user_panel_traffic_custom", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserTrafficCustomPrefix, cid),
		}),
	})
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
		}),
	})
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: rows}, nil)
	if err != nil {
		slog.Error("admin traffic menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserTrafficSetHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, idx, ok := parseCIDIndex(CallbackAdminUserTrafficSetPrefix, cb.Data)
	if !ok {
		return
	}
	h.adminUserTrafficApply(ctx, b, cb, cid, idx)
}

func (h Handler) adminUserTrafficApply(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery, cid int64, presetIdx int) {
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	presets := trafficLimitPresetsGB()
	if presetIdx < 0 || presetIdx >= len(presets) {
		return
	}
	bytes := gbToBytes(presets[presetIdx])
	cust, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_cal_no_rw_user"),
			ShowAlert:       true,
		})
		return
	}
	st := strings.TrimSpace(rw.Status)
	if st == "" {
		st = "ACTIVE"
	}
	req := &remnawave.UpdateUserRequest{
		UUID:              &rw.UUID,
		Status:            st,
		TrafficLimitBytes: &bytes,
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin traffic patch", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin traffic sync", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	lang := cb.From.LanguageCode
	text, markup := h.adminUserManageContent(ctx, b, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, markup, nil)
	if err != nil {
		slog.Error("admin traffic refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "admin_user_panel_saved"),
	})
}

// Отключить --------------------------------------------------------------------

func (h Handler) AdminUserDisableAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserDisableAskPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.translation.GetText(lang, "admin_user_disable_confirm_text")
	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_user_disable_confirm_yes", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserDisableConfirmPrefix, cid),
			}),
			h.translation.WithButton(lang, "admin_user_disable_confirm_no", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
			}),
		},
	}
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin disable ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserDisableConfirmHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserDisableConfirmPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_cal_no_rw_user"),
			ShowAlert:       true,
		})
		return
	}
	req := &remnawave.UpdateUserRequest{
		UUID:   &rw.UUID,
		Status: "DISABLED",
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin disable patch", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin disable sync", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	lang := cb.From.LanguageCode
	text, markup := h.adminUserManageContent(ctx, b, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, markup, nil)
	if err != nil {
		slog.Error("admin disable refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "admin_user_panel_disabled_ok"),
	})
}

func (h Handler) AdminUserEnableAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserEnableAskPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.translation.GetText(lang, "admin_user_enable_confirm_text")
	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_user_enable_confirm_yes", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserEnableConfirmPrefix, cid),
			}),
			h.translation.WithButton(lang, "admin_user_disable_confirm_no", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
			}),
		},
	}
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin enable ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserEnableConfirmHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserEnableConfirmPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_cal_no_rw_user"),
			ShowAlert:       true,
		})
		return
	}
	req := &remnawave.UpdateUserRequest{
		UUID:   &rw.UUID,
		Status: "ACTIVE",
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin enable patch", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin enable sync", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	lang := cb.From.LanguageCode
	text, markup := h.adminUserManageContent(ctx, b, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, markup, nil)
	if err != nil {
		slog.Error("admin enable refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "admin_user_panel_enabled_ok"),
	})
}

// Удалить ----------------------------------------------------------------------

func (h Handler) AdminUserDeleteAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserDeleteAskPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := h.translation.GetText(lang, "admin_user_delete_confirm_text")
	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_user_delete_confirm_yes", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserDeleteConfirmPrefix, cid),
			}),
			h.translation.WithButton(lang, "admin_user_delete_confirm_no", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
			}),
		},
	}
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin delete ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserDeleteConfirmHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserDeleteConfirmPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	linkedToCabinet, lerr := h.customerRepository.HasCabinetLink(ctx, cust.ID)
	if lerr != nil {
		slog.Error("admin delete link check", "error", lerr)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if linkedToCabinet {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            "Пользователь привязан к кабинету. Удаление из админки заблокировано.",
			ShowAlert:       true,
		})
		return
	}
	rw, errRW := h.remnawaveClient.GetUserTrafficInfo(ctx, cust.TelegramID)
	if errRW == nil && rw != nil {
		if err := h.remnawaveClient.DeleteUser(ctx, rw.UUID); err != nil {
			slog.Error("admin delete rw", "error", err)
			_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
				CallbackQueryID: cb.ID,
				Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
				ShowAlert:       true,
			})
			return
		}
	}
	if err := h.customerRepository.DeleteByID(ctx, cust.ID); err != nil {
		slog.Error("admin delete customer db", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	lang := cb.From.LanguageCode
	text := h.translation.GetText(lang, "admin_user_delete_done")
	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_users_all", models.InlineKeyboardButton{
				CallbackData: CallbackAdminUsersListAllPrefix + "0",
			}),
		},
	}
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin delete edit", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserTrafficCustomAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserTrafficCustomPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	adminUserDescriptionClear(cb.From.ID)
	adminTrafficLimitSet(cb.From.ID, cid)
	text := h.translation.GetText(lang, "admin_user_panel_traffic_custom_prompt")
	kb := [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserTrafficMenuPrefix, cid),
			}),
		},
	}
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin traffic custom ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserTrafficLimitTextHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil || update.Message.Text == "" {
		return
	}
	adminID := update.Message.From.ID
	if adminID != config.GetAdminTelegramId() || update.Message.ReplyToMessage != nil {
		return
	}
	cid, ok := adminTrafficLimitCustomer(adminID)
	if !ok {
		return
	}
	lang := update.Message.From.LanguageCode
	raw := strings.TrimSpace(update.Message.Text)
	raw = strings.ReplaceAll(raw, ",", ".")
	gbVal, err := strconv.ParseFloat(raw, 64)
	if err != nil || gbVal <= 0 || gbVal > 1e6 {
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_user_panel_traffic_custom_invalid"),
		})
		return
	}
	bytes := int64(math.Round(gbVal * float64(1024*1024*1024)))
	cust, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		adminTrafficLimitClear(adminID)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_user_cal_no_rw_user"),
		})
		return
	}
	st := strings.TrimSpace(rw.Status)
	if st == "" {
		st = "ACTIVE"
	}
	req := &remnawave.UpdateUserRequest{
		UUID:              &rw.UUID,
		Status:            st,
		TrafficLimitBytes: &bytes,
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin traffic custom patch", "error", err)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_user_action_error"),
		})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin traffic custom sync", "error", err)
	}
	adminTrafficLimitClear(adminID)
	cust, _ = h.customerRepository.FindById(ctx, cid)
	text, markup := h.adminUserManageContent(ctx, b, lang, cust)
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      update.Message.Chat.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: markup,
	})
	if err != nil {
		slog.Error("admin traffic custom send card", "error", err)
		return
	}
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    update.Message.Chat.ID,
		MessageID: update.Message.ID,
	})
}

func (h Handler) adminRefreshSubscriptionMessage(ctx context.Context, b *bot.Bot, msg *models.Message, lang string, custID int64) error {
	cust, err := h.customerRepository.FindById(ctx, custID)
	if err != nil || cust == nil {
		return err
	}
	text := h.adminUserSubscriptionScreenHTML(ctx, b, lang, cust)
	kb := h.adminUserSubscriptionSubmenuKeyboard(ctx, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	return err
}

func (h Handler) adminUserExtraHwidApplyDelta(ctx context.Context, b *bot.Bot, cb *models.CallbackQuery, custID int64, delta int) {
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	cust, err := h.customerRepository.FindById(ctx, custID)
	if err != nil || cust == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
		return
	}
	if err := h.cleanupExpiredExtraHwid(ctx, cust); err != nil {
		slog.Error("admin extra hwid cleanup", "error", err)
	}
	cust, err = h.customerRepository.FindById(ctx, custID)
	if err != nil || cust == nil {
		return
	}
	newExtra := cust.ExtraHwid + delta
	if newExtra < 0 {
		newExtra = 0
	}
	cust, rw, err := h.adminRwUserByCustomerID(ctx, custID)
	if err != nil || cust == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
		return
	}
	if rw != nil {
		curLim := resolveCurrentDeviceLimit(rw)
		base := curLim - activeExtraDevices(cust)
		if base < 1 {
			base = 1
		}
		maxTotal := config.HwidMaxDevices()
		if maxTotal > 0 && base+newExtra > maxTotal {
			newExtra = maxTotal - base
			if newExtra < 0 {
				newExtra = 0
			}
		}
		if delta > 0 && newExtra <= cust.ExtraHwid {
			_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_extra_hwid_max"), ShowAlert: true})
			return
		}
		newLim := base + newExtra
		if newLim < 1 {
			newLim = 1
		}
		if _, err := h.remnawaveClient.UpdateUserDeviceLimit(ctx, cust.TelegramID, newLim); err != nil {
			slog.Error("admin extra hwid panel limit", "error", err)
			_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
			return
		}
	}
	updates := map[string]interface{}{"extra_hwid": newExtra, "extra_hwid_expires_at": nil}
	if newExtra > 0 && cust.ExpireAt != nil && cust.ExpireAt.After(time.Now()) {
		updates["extra_hwid_expires_at"] = cust.ExpireAt
	}
	if err := h.customerRepository.UpdateFields(ctx, cust.ID, updates); err != nil {
		slog.Error("admin extra hwid db", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
		return
	}
	if err := h.adminRefreshSubscriptionMessage(ctx, b, msg, lang, custID); err != nil {
		slog.Error("admin extra hwid refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_panel_saved")})
}

func (h Handler) AdminUserExtraHwidDecHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserExtraHwidDecPrefix)
	if !ok {
		return
	}
	h.adminUserExtraHwidApplyDelta(ctx, b, cb, cid, -1)
}

func (h Handler) AdminUserExtraHwidIncHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserExtraHwidIncPrefix)
	if !ok {
		return
	}
	h.adminUserExtraHwidApplyDelta(ctx, b, cb, cid, 1)
}

func (h Handler) AdminUserTariffMenuHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) || h.tariffRepository == nil {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserTariffMenuPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	tariffs, err := h.tariffRepository.ListActive(ctx)
	if err != nil || len(tariffs) == 0 {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_tariff_none"), ShowAlert: true})
		return
	}
	var rows [][]models.InlineKeyboardButton
	var row []models.InlineKeyboardButton
	for i := range tariffs {
		t := &tariffs[i]
		label := displayTariffName(t)
		if len([]rune(label)) > 36 {
			runes := []rune(label)
			label = string(runes[:33]) + "…"
		}
		row = append(row, models.InlineKeyboardButton{
			Text:         label,
			CallbackData: fmt.Sprintf("%s%d_%d", CallbackAdminUserTariffPickPrefix, cid, t.ID),
		})
		if len(row) == 2 || i == len(tariffs)-1 {
			rows = append(rows, row)
			row = nil
		}
	}
	if len(row) > 0 {
		rows = append(rows, row)
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
		}),
	})
	text := h.translation.GetText(lang, "admin_user_tariff_pick_title")
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: rows}, nil)
	if err != nil {
		slog.Error("admin tariff menu", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserTariffPickHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) || h.tariffRepository == nil {
		return
	}
	cb := update.CallbackQuery
	cid, tidIdx, ok := parseCIDIndex(CallbackAdminUserTariffPickPrefix, cb.Data)
	if !ok {
		return
	}
	tariffID := int64(tidIdx)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	tariff, err := h.tariffRepository.GetByID(ctx, tariffID)
	if err != nil || tariff == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	profile := payment.BuildRemnawaveTariffProfile(tariff)
	out, err := h.remnawaveClient.CreateOrUpdateUserWithTariffProfile(ctx, cust.ID, cust.TelegramID, 0, profile)
	if err != nil {
		slog.Error("admin tariff apply", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
		return
	}
	if err := h.adminSyncCustomerAfterPatch(ctx, cust.ID, out); err != nil {
		slog.Error("admin tariff sync", "error", err)
	}
	if err := h.customerRepository.UpdateFields(ctx, cust.ID, map[string]interface{}{"current_tariff_id": tariff.ID}); err != nil {
		slog.Error("admin tariff db", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	if err := h.cleanupExpiredExtraHwid(ctx, cust); err != nil {
		slog.Error("admin tariff extra cleanup", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	if activeExtraDevices(cust) > 0 {
		rw2, err := h.remnawaveClient.GetUserTrafficInfo(ctx, cust.TelegramID)
		if err == nil && rw2 != nil && rw2.HwidDeviceLimit != nil {
			ex := activeExtraDevices(cust)
			newLim := *rw2.HwidDeviceLimit + ex
			if maxL := config.HwidMaxDevices(); maxL > 0 && newLim > maxL {
				newLim = maxL
			}
			if _, err := h.remnawaveClient.UpdateUserDeviceLimit(ctx, cust.TelegramID, newLim); err != nil {
				slog.Error("admin tariff extra relimit", "error", err)
			}
		}
	}
	if err := h.adminRefreshSubscriptionMessage(ctx, b, msg, lang, cid); err != nil {
		slog.Error("admin tariff refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_panel_saved")})
}

func (h Handler) AdminUserDescriptionAskHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserDescAskPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	adminTrafficLimitClear(cb.From.ID)
	adminUserDescriptionSet(cb.From.ID, cid)
	text := h.translation.GetText(lang, "admin_user_desc_prompt")
	kb := [][]models.InlineKeyboardButton{
		{
			models.InlineKeyboardButton{
				Text:         "🗑️",
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserDescClearPrefix, cid),
			},
			h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{
				CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
			}),
		},
	}
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin desc ask", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserDescriptionClearHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserDescClearPrefix)
	if !ok {
		return
	}
	adminUserDescriptionClear(cb.From.ID)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	_, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_cal_no_rw_user"), ShowAlert: true})
		return
	}
	st := strings.TrimSpace(rw.Status)
	if st == "" {
		st = "ACTIVE"
	}
	empty := ""
	req := &remnawave.UpdateUserRequest{UUID: &rw.UUID, Status: st, Description: &empty}
	if _, err := h.remnawaveClient.PatchUser(ctx, req); err != nil {
		slog.Error("admin desc clear patch", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_action_error"), ShowAlert: true})
		return
	}
	if err := h.adminRefreshSubscriptionMessage(ctx, b, msg, lang, cid); err != nil {
		slog.Error("admin desc clear refresh", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID, Text: h.translation.GetText(lang, "admin_user_panel_saved")})
}

func (h Handler) AdminUserDescriptionTextHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil || update.Message.Text == "" {
		return
	}
	adminID := update.Message.From.ID
	if adminID != config.GetAdminTelegramId() || update.Message.ReplyToMessage != nil {
		return
	}
	cid, ok := adminUserDescriptionCustomer(adminID)
	if !ok {
		return
	}
	lang := update.Message.From.LanguageCode
	raw := strings.TrimSpace(update.Message.Text)
	if len([]rune(raw)) > 500 {
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_user_desc_too_long"),
		})
		return
	}
	_, rw, err := h.adminRwUserByCustomerID(ctx, cid)
	if err != nil || rw == nil {
		adminUserDescriptionClear(adminID)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_user_cal_no_rw_user"),
		})
		return
	}
	st := strings.TrimSpace(rw.Status)
	if st == "" {
		st = "ACTIVE"
	}
	desc := raw
	req := &remnawave.UpdateUserRequest{UUID: &rw.UUID, Status: st, Description: &desc}
	if _, err := h.remnawaveClient.PatchUser(ctx, req); err != nil {
		slog.Error("admin desc text patch", "error", err)
		adminUserDescriptionClear(adminID)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:    update.Message.Chat.ID,
			ParseMode: models.ParseModeHTML,
			Text:      h.translation.GetText(lang, "admin_user_action_error"),
		})
		return
	}
	adminUserDescriptionClear(adminID)
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	text := h.adminUserSubscriptionScreenHTML(ctx, b, lang, cust)
	kbRows := h.adminUserSubscriptionSubmenuKeyboard(ctx, lang, cust)
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      update.Message.Chat.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: kbRows},
	})
	if err != nil {
		slog.Error("admin desc send", "error", err)
		return
	}
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    update.Message.Chat.ID,
		MessageID: update.Message.ID,
	})
}
