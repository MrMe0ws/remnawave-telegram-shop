package handler

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
)

func (h Handler) adminStatsKeyboard(lang, backCallback string) [][]models.InlineKeyboardButton {
	return [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_stats_refresh", models.InlineKeyboardButton{CallbackData: backCallback}),
		},
		{
			h.translation.WithButton(lang, "admin_stats_back", models.InlineKeyboardButton{CallbackData: CallbackAdminStatsRoot}),
		},
	}
}

func (h Handler) adminStatsRootKeyboard(lang string) [][]models.InlineKeyboardButton {
	return [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_stats_btn_users", models.InlineKeyboardButton{CallbackData: CallbackAdminStatsUsers}),
			h.translation.WithButton(lang, "admin_stats_btn_subs", models.InlineKeyboardButton{CallbackData: CallbackAdminStatsSubs}),
		},
		{
			h.translation.WithButton(lang, "admin_stats_btn_revenue", models.InlineKeyboardButton{CallbackData: CallbackAdminStatsRevenue}),
			h.translation.WithButton(lang, "admin_stats_btn_ref", models.InlineKeyboardButton{CallbackData: CallbackAdminStatsRef}),
		},
		{
			h.translation.WithButton(lang, "admin_stats_btn_summary", models.InlineKeyboardButton{CallbackData: CallbackAdminStatsSummary}),
		},
		{
			h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel}),
		},
	}
}

func (h Handler) formatStatsUpdated(lang string, t time.Time) string {
	loc := time.UTC
	if l, err := time.LoadLocation("Europe/Moscow"); err == nil {
		loc = l
	}
	return fmt.Sprintf(h.translation.GetText(lang, "admin_stats_updated_fmt"), t.In(loc).Format("02.01.2006 15:04"))
}

func pctStr(num, den int64) string {
	if den <= 0 {
		return "0.0"
	}
	return fmt.Sprintf("%.1f", float64(num)*100/float64(den))
}

func growthPct(cur, prev int64) string {
	if prev <= 0 {
		if cur > 0 {
			return "100.0"
		}
		return "0.0"
	}
	return fmt.Sprintf("%.1f", float64(cur-prev)*100/float64(prev))
}

// AdminStatsRootHandler корень меню «Статистика».
func (h Handler) AdminStatsRootHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	text := h.translation.GetText(lang, "admin_stats_menu_title") + "\n\n" + h.translation.GetText(lang, "admin_stats_menu_hint")
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: h.adminStatsRootKeyboard(lang)}, nil)
	if err != nil {
		slog.Error("admin stats root", "error", err)
	}
}

// AdminStatsUsersHandler экран «Пользователи».
func (h Handler) AdminStatsUsersHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.statsRepository == nil {
		return
	}
	snap, err := h.statsRepository.FetchAdminStatsSnapshot(ctx)
	if err != nil {
		slog.Error("admin stats users fetch", "error", err)
		return
	}
	actPct := pctStr(snap.ActiveSubscriptions, snap.TotalCustomers)
	gr := growthPct(snap.NewMonth, snap.NewPrevMonth)
	sign := ""
	if snap.NewMonth >= snap.NewPrevMonth {
		sign = "+"
	}
	body := fmt.Sprintf(h.translation.GetText(lang, "admin_stats_users_body"),
		snap.TotalCustomers,
		snap.ActiveSubscriptions,
		actPct,
		snap.NewToday,
		snap.NewWeek,
		snap.NewMonth,
		actPct,
		sign, snap.NewMonth, gr,
	)
	text := h.translation.GetText(lang, "admin_stats_users_title") + "\n\n" + body + "\n\n" + h.formatStatsUpdated(lang, snap.CapturedAt)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: h.adminStatsKeyboard(lang, CallbackAdminStatsUsers)}, nil)
	if err != nil {
		slog.Error("admin stats users edit", "error", err)
	}
}

// AdminStatsSubsHandler экран «Подписки».
func (h Handler) AdminStatsSubsHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.statsRepository == nil {
		return
	}
	snap, err := h.statsRepository.FetchAdminStatsSnapshot(ctx)
	if err != nil {
		slog.Error("admin stats subs fetch", "error", err)
		return
	}
	totalSubs := snap.TrialActive + snap.PaidActive + snap.Inactive
	den := snap.TrialActive + snap.PaidActive
	conv := "0.0"
	if den > 0 {
		conv = fmt.Sprintf("%.1f", float64(snap.PaidActive)*100/float64(den))
	}
	body := fmt.Sprintf(h.translation.GetText(lang, "admin_stats_subs_body"),
		totalSubs,
		snap.TrialActive+snap.PaidActive,
		snap.PaidActive,
		snap.TrialActive,
		conv,
		snap.SalesSubToday,
		snap.SalesSubWeek,
		snap.SalesSubMonth,
	)
	text := h.translation.GetText(lang, "admin_stats_subs_title") + "\n\n" + body + "\n\n" + h.formatStatsUpdated(lang, snap.CapturedAt)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: h.adminStatsKeyboard(lang, CallbackAdminStatsSubs)}, nil)
	if err != nil {
		slog.Error("admin stats subs edit", "error", err)
	}
}

func rubStr(v float64) string {
	if math.Abs(v-math.Round(v)) < 1e-6 {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.2f", v)
}

// AdminStatsRevenueHandler экран «Доходы».
func (h Handler) AdminStatsRevenueHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.statsRepository == nil {
		return
	}
	snap, err := h.statsRepository.FetchAdminStatsSnapshot(ctx)
	if err != nil {
		slog.Error("admin stats revenue fetch", "error", err)
		return
	}
	lines := []string{
		h.translation.GetText(lang, "admin_stats_rev_month_header"),
		fmt.Sprintf(h.translation.GetText(lang, "admin_stats_rev_line_rub"), rubStr(snap.RevenueMonthRub)),
		fmt.Sprintf(h.translation.GetText(lang, "admin_stats_rev_from_subs"), rubStr(snap.RevenueSubsMonthRub)),
		"",
		h.translation.GetText(lang, "admin_stats_rev_today_header"),
		fmt.Sprintf(h.translation.GetText(lang, "admin_stats_rev_tx_n"), snap.TransactionsToday),
		fmt.Sprintf(h.translation.GetText(lang, "admin_stats_rev_line_rub"), rubStr(snap.RevenueTodayRub)),
		"",
		h.translation.GetText(lang, "admin_stats_rev_all_header"),
		fmt.Sprintf(h.translation.GetText(lang, "admin_stats_rev_line_rub"), rubStr(snap.RevenueAllTimeRub)),
		"",
		h.translation.GetText(lang, "admin_stats_rev_methods_header"),
	}
	keys := make([]string, 0, len(snap.PaymentRubByInvoice))
	for k := range snap.PaymentRubByInvoice {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if len(keys) == 0 {
		lines = append(lines, h.translation.GetText(lang, "admin_stats_rev_methods_empty"))
	} else {
		for _, k := range keys {
			labelKey := "admin_stats_inv_" + k
			label := h.translation.GetText(lang, labelKey)
			if label == "" || strings.HasPrefix(label, "admin_stats_inv_") {
				label = k
			}
			lines = append(lines, fmt.Sprintf("• %s: %s ₽", label, rubStr(snap.PaymentRubByInvoice[k])))
		}
	}
	body := strings.Join(lines, "\n")
	text := h.translation.GetText(lang, "admin_stats_rev_title") + "\n\n" + body + "\n\n" + h.formatStatsUpdated(lang, snap.CapturedAt)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: h.adminStatsKeyboard(lang, CallbackAdminStatsRevenue)}, nil)
	if err != nil {
		slog.Error("admin stats revenue edit", "error", err)
	}
}

// AdminStatsRefHandler экран «Реферальная статистика».
func (h Handler) AdminStatsRefHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.statsRepository == nil {
		return
	}
	snap, err := h.statsRepository.FetchAdminStatsSnapshot(ctx)
	if err != nil {
		slog.Error("admin stats ref fetch", "error", err)
		return
	}
	avg := "0"
	if snap.ActiveReferrers > 0 {
		avg = fmt.Sprintf("%.1f", float64(snap.RefBonusDaysAll)/float64(snap.ActiveReferrers))
	}
	var topLines []string
	if len(snap.TopReferrers) == 0 {
		topLines = []string{h.translation.GetText(lang, "admin_stats_ref_top_empty")}
	} else {
		for i, tr := range snap.TopReferrers {
			days, err := h.referralRepository.CalculateEarnedDays(ctx, tr.ReferrerID)
			if err != nil {
				slog.Error("admin stats ref earned days", "error", err, "referrer", tr.ReferrerID)
				days = 0
			}
			label := getReferralDisplayName(ctx, b, tr.ReferrerID)
			topLines = append(topLines, fmt.Sprintf(h.translation.GetText(lang, "admin_stats_ref_top_line"), i+1, label, tr.PaidReferees, days))
		}
	}
	topBlock := strings.Join(topLines, "\n")
	body := fmt.Sprintf(h.translation.GetText(lang, "admin_stats_ref_body"),
		snap.DistinctReferrers,
		snap.ActiveReferrers,
		snap.RefBonusDaysAll,
		snap.RefBonusDaysToday,
		snap.RefBonusDaysWeek,
		snap.RefBonusDaysMonth,
		avg,
		topBlock,
	)
	text := h.translation.GetText(lang, "admin_stats_ref_title") + "\n\n" + body + "\n\n" + h.formatStatsUpdated(lang, snap.CapturedAt)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: h.adminStatsKeyboard(lang, CallbackAdminStatsRef)}, nil)
	if err != nil {
		slog.Error("admin stats ref edit", "error", err)
	}
}

// AdminStatsSummaryHandler общая сводка.
func (h Handler) AdminStatsSummaryHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.statsRepository == nil {
		return
	}
	snap, err := h.statsRepository.FetchAdminStatsSnapshot(ctx)
	if err != nil {
		slog.Error("admin stats summary fetch", "error", err)
		return
	}
	den := snap.TrialActive + snap.PaidActive
	conv := "0.0"
	if den > 0 {
		conv = fmt.Sprintf("%.1f", float64(snap.PaidActive)*100/float64(den))
	}
	arpu := "0"
	if snap.UniquePayersMonth > 0 {
		arpu = rubStr(snap.RevenueMonthRub / float64(snap.UniquePayersMonth))
	}
	signU := ""
	if snap.NewMonth >= snap.NewPrevMonth {
		signU = "+"
	}
	grU := growthPct(snap.NewMonth, snap.NewPrevMonth)
	signS := ""
	if snap.SalesSubMonth >= snap.SalesSubPrevMonth {
		signS = "+"
	}
	grS := growthPct(snap.SalesSubMonth, snap.SalesSubPrevMonth)
	activeVPN := snap.TrialActive + snap.PaidActive
	body := fmt.Sprintf(h.translation.GetText(lang, "admin_stats_summary_body"),
		snap.TotalCustomers,
		snap.ActiveSubscriptions,
		snap.NewMonth,
		activeVPN,
		snap.PaidActive,
		conv,
		rubStr(snap.RevenueMonthRub),
		arpu,
		snap.TransactionsMonth,
		signU, snap.NewMonth, grU,
		signS, snap.SalesSubMonth, grS,
	)
	text := h.translation.GetText(lang, "admin_stats_summary_title") + "\n\n" + body + "\n\n" + h.formatStatsUpdated(lang, snap.CapturedAt)
	_, err = editCallbackOriginToHTMLText(ctx, b, msg, text, models.ParseModeHTML, models.InlineKeyboardMarkup{InlineKeyboard: h.adminStatsKeyboard(lang, CallbackAdminStatsSummary)}, nil)
	if err != nil {
		slog.Error("admin stats summary edit", "error", err)
	}
}
