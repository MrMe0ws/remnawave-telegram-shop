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

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/remnawave"
)

// sendInfraWizardPrompt — текстовый шаг мастера с кнопкой «Назад» (callback очищает мастер и возвращает экран).
func (h Handler) sendInfraWizardPrompt(ctx context.Context, b *bot.Bot, chatID int64, lang, htmlText, backCallback string) error {
	var reply *models.InlineKeyboardMarkup
	if backCallback != "" {
		reply = &models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "admin_infra_wiz_back", models.InlineKeyboardButton{CallbackData: backCallback})},
		}}
	}
	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:             chatID,
		ParseMode:          models.ParseModeHTML,
		Text:               htmlText,
		LinkPreviewOptions: infraNoLinkPreview(),
		ReplyMarkup:        reply,
	})
	return err
}

// AdminInfraWizBackRouter — префикс ifb* (отмена текстового мастера, возврат к экрану).
func (h Handler) AdminInfraWizBackRouter(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	infraWizClear(cb.From.ID)
	switch cb.Data {
	case cbInfraWizBackProv:
		body, err := h.remnawaveClient.GetInfraBillingProviders(ctx)
		if err != nil {
			h.editAdminInfraAPIError(ctx, b, msg, lang, err)
			return
		}
		text, kb := h.infraProvidersScreen(lang, body)
		_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
			ChatID:             msg.Chat.ID,
			MessageID:          msg.ID,
			ParseMode:          models.ParseModeHTML,
			Text:               text,
			LinkPreviewOptions: infraNoLinkPreview(),
			ReplyMarkup:        models.InlineKeyboardMarkup{InlineKeyboard: kb},
		})
		logEditError("infra wiz back prov", err)
	case cbInfraWizBackNodes:
		if err := h.renderAdminInfraNodesScreen(ctx, b, msg.Chat.ID, msg.ID, lang); err != nil {
			h.editAdminInfraAPIError(ctx, b, msg, lang, err)
		}
	case cbInfraWizBackHist:
		page := getInfraHistLastPage(cb.From.ID)
		if err := h.renderInfraHistoryPage(ctx, b, msg, lang, page); err != nil {
			h.editAdminInfraAPIError(ctx, b, msg, lang, err)
		}
	}
}

const infraHistoryPageSize = 10

func adminInfraTZ() *time.Location {
	if l, err := time.LoadLocation("Europe/Moscow"); err == nil {
		return l
	}
	return time.UTC
}

func formatInfraAmount(v float64) string {
	s := strconv.FormatFloat(v, 'f', 2, 64)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	if s == "" {
		return "0"
	}
	return s
}

func formatInfraUSD(v float64) string {
	return "$" + strconv.FormatFloat(v, 'f', 2, 64)
}

func infraNoLinkPreview() *models.LinkPreviewOptions {
	off := true
	return &models.LinkPreviewOptions{IsDisabled: &off}
}

func infraMonthNameInLoc(m time.Month, lang string) string {
	if strings.HasPrefix(lang, "ru") {
		names := []string{
			"", "январе", "феврале", "марте", "апреле", "мае", "июне",
			"июле", "августе", "сентябре", "октябре", "ноябре", "декабре",
		}
		if int(m) >= 1 && int(m) < len(names) {
			return names[m]
		}
	}
	return m.String()
}

func infraRuRootUpcomingTail(n int) string {
	if n == 0 {
		return "нод с предстоящей оплатой"
	}
	if n%10 == 1 && n%100 != 11 {
		return "нода с предстоящей оплатой"
	}
	if n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20) {
		return "ноды с предстоящей оплатой"
	}
	return "нод с предстоящей оплатой"
}

func infraEnRootUpcomingTail(n int) string {
	if n == 1 {
		return "node awaiting payment"
	}
	return "nodes awaiting payment"
}

func (h Handler) infraBillingRootMessageHTML(lang string, body *remnawave.InfraBillingNodesBody) string {
	loc := adminInfraTZ()
	now := time.Now().In(loc)
	month := infraMonthNameInLoc(now.Month(), lang)
	st := body.Stats
	var tail string
	if strings.HasPrefix(lang, "ru") {
		tail = infraRuRootUpcomingTail(st.UpcomingNodesCount)
	} else {
		tail = infraEnRootUpcomingTail(st.UpcomingNodesCount)
	}
	line1 := fmt.Sprintf(h.translation.GetText(lang, "admin_infra_root_line1"), month, st.UpcomingNodesCount, tail)
	line2 := fmt.Sprintf(h.translation.GetText(lang, "admin_infra_root_line2"), month, st.CurrentMonthPayments)
	line3 := fmt.Sprintf(h.translation.GetText(lang, "admin_infra_root_line3"), formatInfraUSD(st.TotalSpent))
	return h.translation.GetText(lang, "admin_infra_root_heading") + "\n\n" + line1 + "\n" + line2 + "\n" + line3
}

func (h Handler) adminInfraRootKeyboard(lang string) [][]models.InlineKeyboardButton {
	return [][]models.InlineKeyboardButton{
		{
			h.translation.WithButton(lang, "admin_infra_btn_nodes", models.InlineKeyboardButton{CallbackData: CallbackAdminInfraNodes}),
			h.translation.WithButton(lang, "admin_infra_btn_notify", models.InlineKeyboardButton{CallbackData: CallbackAdminInfraNotify}),
		},
		{
			h.translation.WithButton(lang, "admin_infra_btn_history", models.InlineKeyboardButton{CallbackData: CallbackAdminInfraHist}),
			h.translation.WithButton(lang, "admin_infra_btn_providers", models.InlineKeyboardButton{CallbackData: CallbackAdminInfraProv}),
		},
		{h.translation.WithButton(lang, "admin_infra_back_admin", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel})},
	}
}

func (h Handler) adminInfraBackRootRow(lang string) [][]models.InlineKeyboardButton {
	return [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "admin_infra_back_root", models.InlineKeyboardButton{CallbackData: CallbackAdminInfraRoot})},
	}
}

func parseInfraHistoryPage(data string) int {
	if !strings.HasPrefix(data, CallbackAdminInfraHist) {
		return 1
	}
	parts := strings.SplitN(data, "?", 2)
	if len(parts) != 2 {
		return 1
	}
	for _, item := range strings.Split(parts[1], "&") {
		kv := strings.SplitN(item, "=", 2)
		if len(kv) != 2 || kv[0] != "p" {
			continue
		}
		p, err := strconv.Atoi(kv[1])
		if err != nil || p < 1 {
			return 1
		}
		return p
	}
	return 1
}

func infraHistoryCallback(page int) string {
	if page < 1 {
		page = 1
	}
	return fmt.Sprintf("%s?p=%d", CallbackAdminInfraHist, page)
}

// AdminInfraRootHandler — корень «Инфра-биллинг».
func (h Handler) AdminInfraRootHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.infraBillingRepository == nil {
		return
	}
	infraWizClear(cb.From.ID)
	body, err := h.remnawaveClient.GetInfraBillingNodes(ctx)
	if err != nil {
		h.editAdminInfraAPIError(ctx, b, msg, lang, err)
		return
	}
	text := h.infraBillingRootMessageHTML(lang, body)
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.adminInfraRootKeyboard(lang)},
	})
	logEditError("admin infra root", err)
}

// AdminInfraNodesHandler — список нод и дат оплаты.
func (h Handler) AdminInfraNodesHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	infraWizClear(cb.From.ID)
	if err := h.renderAdminInfraNodesScreen(ctx, b, msg.Chat.ID, msg.ID, lang); err != nil {
		h.editAdminInfraAPIError(ctx, b, msg, lang, err)
	}
}

func (h Handler) editAdminInfraAPIError(ctx context.Context, b *bot.Bot, msg *models.Message, lang string, err error) {
	slog.Error("admin infra billing api", "error", err)
	text := h.translation.GetText(lang, "admin_infra_api_error")
	_, e := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.adminInfraBackRootRow(lang)},
	})
	logEditError("admin infra api error message", e)
}

func (h Handler) adminInfraNotifyToggleButton(lang string, days int, on bool) models.InlineKeyboardButton {
	key := "admin_infra_notify_off"
	if on {
		key = "admin_infra_notify_on"
	}
	text := fmt.Sprintf(h.translation.GetText(lang, key), days)
	return models.InlineKeyboardButton{
		Text:         text,
		CallbackData: fmt.Sprintf("%s%d", CallbackAdminInfraToggle, days),
	}
}

func (h Handler) adminInfraNotifyKeyboard(lang string, st struct {
	N1, N3, N7, N14 bool
}) [][]models.InlineKeyboardButton {
	kb := [][]models.InlineKeyboardButton{
		{h.adminInfraNotifyToggleButton(lang, 1, st.N1), h.adminInfraNotifyToggleButton(lang, 3, st.N3)},
		{h.adminInfraNotifyToggleButton(lang, 7, st.N7), h.adminInfraNotifyToggleButton(lang, 14, st.N14)},
	}
	kb = append(kb, h.adminInfraBackRootRow(lang)...)
	return kb
}

// AdminInfraNotifyHandler — тумблеры напоминаний за N дней.
func (h Handler) AdminInfraNotifyHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil || h.infraBillingRepository == nil {
		return
	}
	st, err := h.infraBillingRepository.GetSettings(ctx)
	if err != nil {
		slog.Error("admin infra notify settings", "error", err)
		return
	}
	type nk struct{ N1, N3, N7, N14 bool }
	k := nk{N1: st.NotifyBefore1, N3: st.NotifyBefore3, N7: st.NotifyBefore7, N14: st.NotifyBefore14}
	text := h.translation.GetText(lang, "admin_infra_notify_title") + "\n\n" + h.translation.GetText(lang, "admin_infra_notify_hint")
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.adminInfraNotifyKeyboard(lang, k)},
	})
	logEditError("admin infra notify", err)
}

// AdminInfraToggleHandler — callback ibt1 / ibt3 / ibt7 / ibt14.
func (h Handler) AdminInfraToggleHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	data := cb.Data
	if !strings.HasPrefix(data, CallbackAdminInfraToggle) || h.infraBillingRepository == nil {
		return
	}
	suf := strings.TrimPrefix(data, CallbackAdminInfraToggle)
	days, err := strconv.Atoi(suf)
	if err != nil || (days != 1 && days != 3 && days != 7 && days != 14) {
		return
	}
	st, err := h.infraBillingRepository.GetSettings(ctx)
	if err != nil {
		slog.Error("admin infra toggle get", "error", err)
		return
	}
	var cur bool
	switch days {
	case 1:
		cur = st.NotifyBefore1
	case 3:
		cur = st.NotifyBefore3
	case 7:
		cur = st.NotifyBefore7
	case 14:
		cur = st.NotifyBefore14
	}
	if err := h.infraBillingRepository.SetNotifyBefore(ctx, days, !cur); err != nil {
		slog.Error("admin infra toggle set", "error", err)
		return
	}
	st2, err := h.infraBillingRepository.GetSettings(ctx)
	if err != nil {
		slog.Error("admin infra toggle get2", "error", err)
		return
	}
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	lang := cb.From.LanguageCode
	type nk struct{ N1, N3, N7, N14 bool }
	k := nk{N1: st2.NotifyBefore1, N3: st2.NotifyBefore3, N7: st2.NotifyBefore7, N14: st2.NotifyBefore14}
	text := h.translation.GetText(lang, "admin_infra_notify_title") + "\n\n" + h.translation.GetText(lang, "admin_infra_notify_hint")
	_, err = b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      msg.Chat.ID,
		MessageID:   msg.ID,
		ParseMode:   models.ParseModeHTML,
		Text:        text,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.adminInfraNotifyKeyboard(lang, k)},
	})
	logEditError("admin infra toggle edit", err)
}

// AdminInfraHistoryHandler — история оплат (пагинация по 10).
func (h Handler) AdminInfraHistoryHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	page := parseInfraHistoryPage(cb.Data)
	infraWizClear(cb.From.ID)
	if err := h.renderInfraHistoryPage(ctx, b, msg, lang, page); err != nil {
		h.editAdminInfraAPIError(ctx, b, msg, lang, err)
	}
}

// AdminInfraProvidersHandler — список провайдеров.
func (h Handler) AdminInfraProvidersHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	lang := cb.From.LanguageCode
	msg := cb.Message.Message
	if msg == nil {
		return
	}
	infraWizClear(cb.From.ID)
	if err := h.renderAdminInfraProvidersScreen(ctx, b, msg.Chat.ID, msg.ID, lang); err != nil {
		h.editAdminInfraAPIError(ctx, b, msg, lang, err)
	}
}
