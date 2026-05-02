package handler

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"remnawave-tg-shop-bot/internal/remnawave"
)

// Инлайн-календарь для выбора даты окончания подписки (PATCH expireAt в Remnawave).

func panelExpireFromRW(rw *remnawave.User) *time.Time {
	if rw == nil || rw.ExpireAt.IsZero() {
		return nil
	}
	t := rw.ExpireAt.UTC()
	return &t
}

func fmtCalYM(y int, m time.Month) int {
	return y*100 + int(m)
}

func parseCalYM(code int) (int, time.Month) {
	y := code / 100
	mm := code % 100
	return y, time.Month(mm)
}

func calNavCallback(cid int64, ym int) string {
	return fmt.Sprintf("%s%d_%d", CallbackAdminUserCalNavPrefix, cid, ym)
}

func calPickCallback(cid int64, date int) string {
	return fmt.Sprintf("%s%d_%d", CallbackAdminUserCalPickPrefix, cid, date)
}

func calBlankCallback(cid int64, ym int) string {
	return fmt.Sprintf("%s%d_%d", CallbackAdminUserCalBlankPrefix, cid, ym)
}

func sameUTCDateParts(y int, mo time.Month, day int, exp time.Time) bool {
	if exp.IsZero() {
		return false
	}
	ey, em, ed := exp.UTC().Date()
	return ey == y && em == mo && ed == day
}

func buildExpireCalendarMarkupWithH(h Handler, lang string, cid int64, ref time.Time, panelExpire *time.Time) [][]models.InlineKeyboardButton {
	y, mo := ref.Year(), ref.Month()
	first := time.Date(y, mo, 1, 12, 0, 0, 0, time.UTC)
	firstMondayOffset := int(first.Weekday()+6) % 7
	daysInMo := time.Date(y, mo+1, 0, 12, 0, 0, 0, time.UTC).Day()

	prev := first.AddDate(0, -1, 0)
	next := first.AddDate(0, 1, 0)
	prevYM := fmtCalYM(prev.Year(), prev.Month())
	nextYM := fmtCalYM(next.Year(), next.Month())
	curYM := fmtCalYM(y, mo)

	var rows [][]models.InlineKeyboardButton
	rows = append(rows, []models.InlineKeyboardButton{
		{Text: "◀️", CallbackData: calNavCallback(cid, prevYM)},
		{Text: "·", CallbackData: calBlankCallback(cid, curYM)},
		{Text: "▶️", CallbackData: calNavCallback(cid, nextYM)},
	})

	var row []models.InlineKeyboardButton
	slot := 0
	totalSlots := firstMondayOffset + daysInMo

	for slot < totalSlots {
		if len(row) == 7 {
			rows = append(rows, row)
			row = nil
		}
		if slot < firstMondayOffset {
			row = append(row, models.InlineKeyboardButton{
				Text:         "·",
				CallbackData: calBlankCallback(cid, curYM),
			})
			slot++
			continue
		}
		day := slot - firstMondayOffset + 1
		dateInt := y*10000 + int(mo)*100 + day
		btn := models.InlineKeyboardButton{
			Text:         strconv.Itoa(day),
			CallbackData: calPickCallback(cid, dateInt),
		}
		if panelExpire != nil && sameUTCDateParts(y, mo, day, *panelExpire) {
			btn.Style = "primary"
		}
		row = append(row, btn)
		slot++
	}
	for len(row) > 0 && len(row) < 7 {
		row = append(row, models.InlineKeyboardButton{
			Text:         "·",
			CallbackData: calBlankCallback(cid, curYM),
		})
	}
	if len(row) > 0 {
		rows = append(rows, row)
	}
	rows = append(rows, []models.InlineKeyboardButton{
		h.translation.WithButton(lang, "admin_user_cal_btn_subscription_back", models.InlineKeyboardButton{
			CallbackData: fmt.Sprintf("%s%d", CallbackAdminUserSubscriptionPrefix, cid),
		}),
	})
	return rows
}

func parseCalCIDYM(prefix, data string) (cid int64, ym int, ok bool) {
	if !strings.HasPrefix(data, prefix) {
		return 0, 0, false
	}
	rest := strings.TrimPrefix(data, prefix)
	idx := strings.LastIndex(rest, "_")
	if idx <= 0 || idx >= len(rest)-1 {
		return 0, 0, false
	}
	var err error
	cid, err = strconv.ParseInt(rest[:idx], 10, 64)
	if err != nil || cid <= 0 {
		return 0, 0, false
	}
	ym, err = strconv.Atoi(rest[idx+1:])
	if err != nil || ym < 197001 || ym > 299912 {
		return 0, 0, false
	}
	return cid, ym, true
}

func parseCalPick(data string) (cid int64, yyyymmdd int, ok bool) {
	if !strings.HasPrefix(data, CallbackAdminUserCalPickPrefix) {
		return 0, 0, false
	}
	rest := strings.TrimPrefix(data, CallbackAdminUserCalPickPrefix)
	idx := strings.LastIndex(rest, "_")
	if idx <= 0 || idx >= len(rest)-1 {
		return 0, 0, false
	}
	var err error
	cid, err = strconv.ParseInt(rest[:idx], 10, 64)
	if err != nil || cid <= 0 {
		return 0, 0, false
	}
	yyyymmdd, err = strconv.Atoi(rest[idx+1:])
	if err != nil || yyyymmdd < 19700101 || yyyymmdd > 29991231 {
		return 0, 0, false
	}
	return cid, yyyymmdd, true
}

func (h Handler) AdminUserCalOpenHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ok := parseCustomerIDFromPrefix(cb.Data, CallbackAdminUserCalOpenPrefix)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	lang := cb.From.LanguageCode
	ref := time.Now().UTC()
	text := fmt.Sprintf(h.translation.GetText(lang, "admin_user_cal_title"), int(ref.Month()), ref.Year())
	var panelExp *time.Time
	if rw, err := h.adminFindRWUserByCustomer(ctx, cust); err == nil {
		panelExp = panelExpireFromRW(rw)
	}
	kb := buildExpireCalendarMarkupWithH(h, lang, cid, ref, panelExp)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin cal open", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserCalNavHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ym, ok := parseCalCIDYM(CallbackAdminUserCalNavPrefix, cb.Data)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	y, m := parseCalYM(ym)
	ref := time.Date(y, m, 1, 12, 0, 0, 0, time.UTC)
	lang := cb.From.LanguageCode
	text := fmt.Sprintf(h.translation.GetText(lang, "admin_user_cal_title"), int(ref.Month()), ref.Year())
	var panelExp *time.Time
	if rw, err := h.adminFindRWUserByCustomer(ctx, cust); err == nil {
		panelExp = panelExpireFromRW(rw)
	}
	kb := buildExpireCalendarMarkupWithH(h, lang, cid, ref, panelExp)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin cal nav", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}

func (h Handler) AdminUserCalPickHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ymd, ok := parseCalPick(cb.Data)
	if !ok {
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	y := ymd / 10000
	md := ymd % 10000
	mo := md / 100
	d := md % 100
	if mo < 1 || mo > 12 || d < 1 || d > 31 {
		return
	}
	now := time.Now().UTC()
	exp := time.Date(y, time.Month(mo), d, now.Hour(), now.Minute(), now.Second(), 0, time.UTC)

	rwUser, err := h.adminFindRWUserByCustomer(ctx, cust)
	if err != nil || rwUser == nil {
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_cal_no_rw_user"),
			ShowAlert:       true,
		})
		return
	}
	req := &remnawave.UpdateUserRequest{
		UUID:     &rwUser.UUID,
		Status:   "ACTIVE",
		ExpireAt: &exp,
	}
	out, err := h.remnawaveClient.PatchUser(ctx, req)
	if err != nil {
		slog.Error("admin cal patch expire", "error", err)
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: cb.ID,
			Text:            h.translation.GetText(cb.From.LanguageCode, "admin_user_action_error"),
			ShowAlert:       true,
		})
		return
	}
	if err := h.customerRepository.UpdateFields(ctx, cust.ID, map[string]interface{}{
		"subscription_link": out.SubscriptionUrl,
		"expire_at":         out.ExpireAt,
	}); err != nil {
		slog.Error("admin cal sync db", "error", err)
	}
	cust, _ = h.customerRepository.FindById(ctx, cid)
	lang := cb.From.LanguageCode
	text, markup := h.adminUserManageContent(ctx, b, lang, cust)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, markup, nil)
	if err != nil {
		slog.Error("admin cal refresh card", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: cb.ID,
		Text:            h.translation.GetText(lang, "admin_user_cal_saved"),
	})
}

func (h Handler) AdminUserCalBlankHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || !isAdmin(update.CallbackQuery) {
		return
	}
	cb := update.CallbackQuery
	cid, ym, ok := parseCalCIDYM(CallbackAdminUserCalBlankPrefix, cb.Data)
	if !ok {
		return
	}
	y, m := parseCalYM(ym)
	ref := time.Date(y, m, 1, 12, 0, 0, 0, time.UTC)
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	cust, err := h.customerRepository.FindById(ctx, cid)
	if err != nil || cust == nil {
		return
	}
	lang := cb.From.LanguageCode
	text := fmt.Sprintf(h.translation.GetText(lang, "admin_user_cal_title"), int(ref.Month()), ref.Year())
	var panelExp *time.Time
	if rw, err := h.adminFindRWUserByCustomer(ctx, cust); err == nil {
		panelExp = panelExpireFromRW(rw)
	}
	kb := buildExpireCalendarMarkupWithH(h, lang, cid, ref, panelExp)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: kb}, nil)
	if err != nil {
		slog.Error("admin cal blank", "error", err)
	}
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{CallbackQueryID: cb.ID})
}
