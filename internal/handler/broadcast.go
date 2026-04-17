package handler

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

// BroadcastType определяет тип рассылки
type BroadcastType string

const (
	BroadcastTypeAll      BroadcastType = "all"      // Всем пользователям
	BroadcastTypeActive   BroadcastType = "active"   // Только активным
	BroadcastTypeInactive BroadcastType = "inactive" // Неактивным
)

// BroadcastRecipientButtons — какие inline-кнопки прикрепить к рассылке.
type BroadcastRecipientButtons struct {
	Buy      bool
	MainMenu bool
	Promo    bool
	Connect  bool
}

// broadcastDraftMedia — черновик рассылки с картинкой (фото или файл JPEG/PNG/WebP).
type broadcastDraftMedia struct {
	FileID  string
	AsPhoto bool // true → sendPhoto, false → sendDocument (файлом)
}

// BroadcastState хранит состояние рассылки для каждого админа
type BroadcastState struct {
	mu                   sync.Mutex
	pendingText          map[int64]string
	pendingEntities      map[int64][]models.MessageEntity
	pendingMedia         map[int64]*broadcastDraftMedia
	pendingButtons       map[int64]BroadcastRecipientButtons
	waitingForInput      map[int64]bool
	waitingForButtonPick map[int64]bool
	selectedType         map[int64]BroadcastType
	promptMessageID      map[int64]int
	pendingPreviewMsgID  map[int64]int
}

func newBroadcastState() *BroadcastState {
	return &BroadcastState{
		pendingText:          make(map[int64]string),
		pendingEntities:      make(map[int64][]models.MessageEntity),
		pendingMedia:         make(map[int64]*broadcastDraftMedia),
		pendingButtons:       make(map[int64]BroadcastRecipientButtons),
		waitingForInput:      make(map[int64]bool),
		waitingForButtonPick: make(map[int64]bool),
		selectedType:         make(map[int64]BroadcastType),
		promptMessageID:      make(map[int64]int),
		pendingPreviewMsgID:  make(map[int64]int),
	}
}

func clearBroadcastState(adminID int64) {
	broadcastState.mu.Lock()
	delete(broadcastState.pendingText, adminID)
	delete(broadcastState.pendingEntities, adminID)
	delete(broadcastState.pendingMedia, adminID)
	delete(broadcastState.pendingButtons, adminID)
	delete(broadcastState.waitingForInput, adminID)
	delete(broadcastState.waitingForButtonPick, adminID)
	delete(broadcastState.selectedType, adminID)
	delete(broadcastState.promptMessageID, adminID)
	delete(broadcastState.pendingPreviewMsgID, adminID)
	broadcastState.mu.Unlock()
}

func resetBroadcastDraft(adminID int64) {
	broadcastState.mu.Lock()
	delete(broadcastState.pendingText, adminID)
	delete(broadcastState.pendingEntities, adminID)
	delete(broadcastState.pendingMedia, adminID)
	delete(broadcastState.pendingButtons, adminID)
	delete(broadcastState.waitingForButtonPick, adminID)
	delete(broadcastState.promptMessageID, adminID)
	delete(broadcastState.pendingPreviewMsgID, adminID)
	broadcastState.mu.Unlock()
}

var broadcastState = newBroadcastState()

// extractBroadcastImageFromMessage — фото как картинка или документ JPEG/PNG/WebP (отправка файлом).
func extractBroadcastImageFromMessage(m *models.Message) (fileID string, asPhoto bool, ok bool) {
	if m == nil {
		return "", false, false
	}
	if len(m.Photo) > 0 {
		last := m.Photo[len(m.Photo)-1]
		return last.FileID, true, true
	}
	if m.Document != nil {
		mime := strings.ToLower(strings.TrimSpace(m.Document.MimeType))
		switch mime {
		case "image/jpeg", "image/jpg", "image/png", "image/webp":
			return m.Document.FileID, false, true
		}
	}
	return "", false, false
}

// BroadcastAwaitingMessageInput — админ выбрал аудиторию и бот ждёт текст/картинку черновика.
func BroadcastAwaitingMessageInput(adminID int64) bool {
	broadcastState.mu.Lock()
	defer broadcastState.mu.Unlock()
	isWaiting, wok := broadcastState.waitingForInput[adminID]
	_, tok := broadcastState.selectedType[adminID]
	return wok && isWaiting && tok
}

// BroadcastIncomingDraftMessage — подходит ли сообщение как черновик рассылки (текст, подпись к медиа или картинка).
func BroadcastIncomingDraftMessage(m *models.Message) bool {
	if m == nil {
		return false
	}
	if strings.TrimSpace(m.Text) != "" && !strings.HasPrefix(m.Text, "/") {
		return true
	}
	if m.Caption != "" {
		return true
	}
	_, _, ok := extractBroadcastImageFromMessage(m)
	return ok
}

// BroadcastAudienceKeyboard выбор аудитории; withBackToAdmin — кнопка «Назад» в админ-меню (экран из админки).
func (h Handler) BroadcastAudienceKeyboard(lang string, withBackToAdmin bool) [][]models.InlineKeyboardButton {
	rows := [][]models.InlineKeyboardButton{
		{h.translation.WithButton(lang, "broadcast_audience_all", models.InlineKeyboardButton{CallbackData: CallbackBroadcastAll})},
		{h.translation.WithButton(lang, "broadcast_audience_active", models.InlineKeyboardButton{CallbackData: CallbackBroadcastActive})},
		{h.translation.WithButton(lang, "broadcast_audience_inactive", models.InlineKeyboardButton{CallbackData: CallbackBroadcastInactive})},
	}
	if withBackToAdmin {
		rows = append(rows, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackBroadcastBackAdmin}),
		})
	}
	return rows
}

// SendBroadcastTypeSelection sends the broadcast audience keyboard (команда /broadcast — отдельное сообщение, без «Назад» в админку).
func (h Handler) SendBroadcastTypeSelection(ctx context.Context, b *bot.Bot, adminChatID int64, lang string) error {
	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      adminChatID,
		ParseMode:   models.ParseModeHTML,
		Text:        h.translation.GetText(lang, "broadcast_choose_audience"),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.BroadcastAudienceKeyboard(lang, false)},
	})
	if err != nil {
		slog.Error("error sending broadcast type selection", "error", err)
	}
	return err
}

// BroadcastCommandHandler обрабатывает команду /broadcast от админа
func (h Handler) BroadcastCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.Message.From.ID != adminID {
		return
	}

	clearBroadcastState(adminID)

	lang := update.Message.From.LanguageCode
	_ = h.SendBroadcastTypeSelection(ctx, b, adminID, lang)
}

func broadcastTypeToAudience(t BroadcastType) string {
	switch t {
	case BroadcastTypeAll:
		return database.BroadcastAudienceAll
	case BroadcastTypeActive:
		return database.BroadcastAudienceActive
	case BroadcastTypeInactive:
		return database.BroadcastAudienceInactive
	default:
		return database.BroadcastAudienceAll
	}
}

func (h Handler) broadcastToggleRow(lang string, on bool, buttonKey, callbackData string) models.InlineKeyboardButton {
	data := h.translation.GetButton(lang, buttonKey)
	prefix := "☐ "
	if on {
		prefix = "✅ "
	}
	return models.InlineKeyboardButton{Text: prefix + data.Text, CallbackData: callbackData}
}

func (h Handler) broadcastButtonPickerKeyboard(lang string, flags BroadcastRecipientButtons) [][]models.InlineKeyboardButton {
	return [][]models.InlineKeyboardButton{
		{h.broadcastToggleRow(lang, flags.Buy, "buy_button", CallbackBroadcastToggleBuy)},
		{h.broadcastToggleRow(lang, flags.Connect, "connect_button", CallbackBroadcastToggleVPN)},
		{h.broadcastToggleRow(lang, flags.Promo, "promo_code_button", CallbackBroadcastTogglePromo)},
		{h.broadcastToggleRow(lang, flags.MainMenu, "broadcast_inline_main", CallbackBroadcastToggleMain)},
		{
			{Text: h.translation.GetText(lang, "broadcast_buttons_next"), CallbackData: CallbackBroadcastButtonsNext},
			{Text: h.translation.GetText(lang, "broadcast_confirm_no"), CallbackData: CallbackBroadcastCancel},
		},
	}
}

func (h Handler) buildBroadcastReplyMarkup(lang string, flags BroadcastRecipientButtons) models.ReplyMarkup {
	if !flags.Buy && !flags.MainMenu && !flags.Promo && !flags.Connect {
		return nil
	}
	var rows [][]models.InlineKeyboardButton
	if flags.Buy {
		rows = append(rows, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "buy_button", models.InlineKeyboardButton{CallbackData: CallbackBuy + BroadcastInlineQuery}),
		})
	}
	if flags.Connect {
		rows = append(rows, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "connect_button", models.InlineKeyboardButton{CallbackData: CallbackConnect + BroadcastInlineQuery}),
		})
	}
	if flags.Promo {
		rows = append(rows, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "promo_code_button", models.InlineKeyboardButton{CallbackData: CallbackEnterPromo + BroadcastInlineQuery}),
		})
	}
	if flags.MainMenu {
		rows = append(rows, []models.InlineKeyboardButton{
			h.translation.WithButton(lang, "broadcast_inline_main", models.InlineKeyboardButton{CallbackData: CallbackStart + BroadcastInlineQuery}),
		})
	}
	return models.InlineKeyboardMarkup{InlineKeyboard: rows}
}

func (h Handler) broadcastButtonsSummaryLine(lang string, flags BroadcastRecipientButtons) string {
	if !flags.Buy && !flags.MainMenu && !flags.Promo && !flags.Connect {
		return h.translation.GetText(lang, "broadcast_buttons_none")
	}
	var parts []string
	if flags.Buy {
		parts = append(parts, h.translation.GetButton(lang, "buy_button").Text)
	}
	if flags.Connect {
		parts = append(parts, h.translation.GetButton(lang, "connect_button").Text)
	}
	if flags.Promo {
		parts = append(parts, h.translation.GetButton(lang, "promo_code_button").Text)
	}
	if flags.MainMenu {
		parts = append(parts, h.translation.GetButton(lang, "broadcast_inline_main").Text)
	}
	return strings.Join(parts, ", ")
}

// BroadcastTypeSelectHandler обрабатывает выбор типа рассылки
func (h Handler) BroadcastTypeSelectHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.CallbackQuery.From.ID != adminID {
		return
	}

	lang := update.CallbackQuery.From.LanguageCode
	var broadcastType BroadcastType
	var summaryKey string

	switch update.CallbackQuery.Data {
	case CallbackBroadcastAll:
		broadcastType = BroadcastTypeAll
		summaryKey = "broadcast_summary_all"
	case CallbackBroadcastActive:
		broadcastType = BroadcastTypeActive
		summaryKey = "broadcast_summary_active"
	case CallbackBroadcastInactive:
		broadcastType = BroadcastTypeInactive
		summaryKey = "broadcast_summary_inactive"
	default:
		return
	}

	typeText := h.translation.GetText(lang, summaryKey)
	callbackMessage := update.CallbackQuery.Message.Message
	if callbackMessage == nil {
		return
	}

	resetBroadcastDraft(adminID)

	broadcastState.mu.Lock()
	broadcastState.selectedType[adminID] = broadcastType
	broadcastState.waitingForInput[adminID] = true
	broadcastState.promptMessageID[adminID] = callbackMessage.ID
	broadcastState.mu.Unlock()

	prompt := fmt.Sprintf(h.translation.GetText(lang, "broadcast_enter_message"), typeText)
	_, err := b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
		ParseMode: models.ParseModeHTML,
		Text:      prompt,
		ReplyMarkup: &models.InlineKeyboardMarkup{
			InlineKeyboard: [][]models.InlineKeyboardButton{},
		},
	})
	if err != nil {
		slog.Error("broadcast prompt edit", "error", err)
	}
}

// BroadcastMessageHandler обрабатывает сообщение от админа с текстом или подписью к медиа после выбора аудитории
func (h Handler) BroadcastMessageHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.Message.From.ID != adminID {
		return
	}

	broadcastState.mu.Lock()
	isWaiting, exists := broadcastState.waitingForInput[adminID]
	_, typeExists := broadcastState.selectedType[adminID]
	if !exists || !isWaiting || !typeExists {
		broadcastState.mu.Unlock()
		return
	}
	broadcastState.mu.Unlock()

	fileID, asPhoto, hasMedia := extractBroadcastImageFromMessage(update.Message)
	var messageText string
	var entities []models.MessageEntity
	if hasMedia {
		messageText = update.Message.Caption
		if len(update.Message.CaptionEntities) > 0 {
			entities = append([]models.MessageEntity(nil), update.Message.CaptionEntities...)
		}
	} else {
		messageText = update.Message.Text
		if len(update.Message.Entities) > 0 {
			entities = append([]models.MessageEntity(nil), update.Message.Entities...)
		}
	}
	if strings.TrimSpace(messageText) == "" && !hasMedia {
		return
	}
	if !hasMedia && len(messageText) > 0 && messageText[0] == '/' {
		return
	}

	var entCopy []models.MessageEntity
	if len(entities) > 0 {
		entCopy = append([]models.MessageEntity(nil), entities...)
	}

	lang := update.Message.From.LanguageCode

	broadcastState.mu.Lock()
	broadcastState.pendingText[adminID] = messageText
	if len(entCopy) > 0 {
		broadcastState.pendingEntities[adminID] = entCopy
	} else {
		delete(broadcastState.pendingEntities, adminID)
	}
	if hasMedia {
		broadcastState.pendingMedia[adminID] = &broadcastDraftMedia{FileID: fileID, AsPhoto: asPhoto}
	} else {
		delete(broadcastState.pendingMedia, adminID)
	}
	broadcastState.pendingButtons[adminID] = BroadcastRecipientButtons{}
	broadcastState.waitingForInput[adminID] = false
	broadcastState.waitingForButtonPick[adminID] = true
	promptMid := broadcastState.promptMessageID[adminID]
	delete(broadcastState.promptMessageID, adminID)
	broadcastState.mu.Unlock()

	if promptMid != 0 {
		_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    adminID,
			MessageID: promptMid,
		})
	}

	flags := BroadcastRecipientButtons{}
	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      adminID,
		ParseMode:   models.ParseModeHTML,
		Text:        h.translation.GetText(lang, "broadcast_pick_buttons"),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.broadcastButtonPickerKeyboard(lang, flags)},
	})
	if err != nil {
		slog.Error("error sending broadcast button picker", "error", err)
	}
}

// BroadcastButtonToggleHandler переключает выбор кнопок под рассылкой
func (h Handler) BroadcastButtonToggleHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil {
		return
	}
	cb := update.CallbackQuery
	adminID := config.GetAdminTelegramId()
	if cb.From.ID != adminID || cb.Message.Message == nil {
		return
	}

	lang := cb.From.LanguageCode

	broadcastState.mu.Lock()
	if !broadcastState.waitingForButtonPick[adminID] {
		broadcastState.mu.Unlock()
		return
	}
	flags := broadcastState.pendingButtons[adminID]
	switch cb.Data {
	case CallbackBroadcastToggleBuy:
		flags.Buy = !flags.Buy
	case CallbackBroadcastToggleMain:
		flags.MainMenu = !flags.MainMenu
	case CallbackBroadcastTogglePromo:
		flags.Promo = !flags.Promo
	case CallbackBroadcastToggleVPN:
		flags.Connect = !flags.Connect
	default:
		broadcastState.mu.Unlock()
		return
	}
	broadcastState.pendingButtons[adminID] = flags
	broadcastState.mu.Unlock()

	pickerMsg := cb.Message.Message
	_, err := b.EditMessageReplyMarkup(ctx, &bot.EditMessageReplyMarkupParams{
		ChatID:      pickerMsg.Chat.ID,
		MessageID:   pickerMsg.ID,
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: h.broadcastButtonPickerKeyboard(lang, flags)},
	})
	if err != nil {
		slog.Error("broadcast toggle edit markup", "error", err)
	}
}

// BroadcastButtonsNextHandler переходит от выбора кнопок к предпросмотру и подтверждению
func (h Handler) BroadcastButtonsNextHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil {
		return
	}
	cb := update.CallbackQuery
	adminID := config.GetAdminTelegramId()
	if cb.From.ID != adminID || cb.Message.Message == nil {
		return
	}

	lang := cb.From.LanguageCode

	broadcastState.mu.Lock()
	if !broadcastState.waitingForButtonPick[adminID] {
		broadcastState.mu.Unlock()
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   h.translation.GetText(lang, "broadcast_session_expired"),
		})
		return
	}
	messageText := broadcastState.pendingText[adminID]
	entities := broadcastState.pendingEntities[adminID]
	flags := broadcastState.pendingButtons[adminID]
	broadcastType := broadcastState.selectedType[adminID]
	var draftMedia *broadcastDraftMedia
	if m, ok := broadcastState.pendingMedia[adminID]; ok {
		cp := *m
		draftMedia = &cp
	}
	broadcastState.waitingForButtonPick[adminID] = false
	broadcastState.mu.Unlock()

	var summaryKey string
	switch broadcastType {
	case BroadcastTypeAll:
		summaryKey = "broadcast_summary_all"
	case BroadcastTypeActive:
		summaryKey = "broadcast_summary_active"
	case BroadcastTypeInactive:
		summaryKey = "broadcast_summary_inactive"
	default:
		summaryKey = "broadcast_summary_all"
	}
	targetText := h.translation.GetText(lang, summaryKey)
	buttonsLine := h.broadcastButtonsSummaryLine(lang, flags)

	pickerMsg := cb.Message.Message
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    pickerMsg.Chat.ID,
		MessageID: pickerMsg.ID,
	})

	var previewMsg *models.Message
	var previewErr error
	markup := h.buildBroadcastReplyMarkup(lang, flags)
	if draftMedia != nil {
		if draftMedia.AsPhoto {
			pp := &bot.SendPhotoParams{
				ChatID:          adminID,
				Photo:           &models.InputFileString{Data: draftMedia.FileID},
				Caption:         messageText,
				CaptionEntities: entities,
			}
			if markup != nil {
				pp.ReplyMarkup = markup
			}
			previewMsg, previewErr = b.SendPhoto(ctx, pp)
		} else {
			dp := &bot.SendDocumentParams{
				ChatID:          adminID,
				Document:        &models.InputFileString{Data: draftMedia.FileID},
				Caption:         messageText,
				CaptionEntities: entities,
			}
			if markup != nil {
				dp.ReplyMarkup = markup
			}
			previewMsg, previewErr = b.SendDocument(ctx, dp)
		}
	} else {
		previewParams := bot.SendMessageParams{
			ChatID: adminID,
			Text:   messageText,
		}
		if len(entities) > 0 {
			previewParams.Entities = entities
		}
		if markup != nil {
			previewParams.ReplyMarkup = markup
		}
		previewMsg, previewErr = b.SendMessage(ctx, &previewParams)
	}
	if previewErr != nil {
		slog.Error("broadcast preview send", "error", previewErr)
	}

	if previewMsg != nil {
		broadcastState.mu.Lock()
		broadcastState.pendingPreviewMsgID[adminID] = previewMsg.ID
		broadcastState.mu.Unlock()
	}

	confirmText := fmt.Sprintf(h.translation.GetText(lang, "broadcast_confirm_question"), targetText, buttonsLine)
	inlineKeyboard := &models.InlineKeyboardMarkup{
		InlineKeyboard: [][]models.InlineKeyboardButton{
			{
				{Text: h.translation.GetText(lang, "broadcast_confirm_yes"), CallbackData: CallbackBroadcastConfirm},
				{Text: h.translation.GetText(lang, "broadcast_confirm_no"), CallbackData: CallbackBroadcastCancel},
			},
		},
	}

	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      adminID,
		ParseMode:   models.ParseModeHTML,
		Text:        confirmText,
		ReplyMarkup: inlineKeyboard,
	})
	if err != nil {
		slog.Error("error sending broadcast confirmation", "error", err)
	}
}

// BroadcastConfirmHandler обрабатывает подтверждение рассылки
func (h Handler) BroadcastConfirmHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.CallbackQuery.From.ID != adminID {
		return
	}

	broadcastState.mu.Lock()
	messageText, exists := broadcastState.pendingText[adminID]
	broadcastType, typeExists := broadcastState.selectedType[adminID]
	entities := broadcastState.pendingEntities[adminID]
	flags := broadcastState.pendingButtons[adminID]
	previewID := broadcastState.pendingPreviewMsgID[adminID]
	var draftMedia *broadcastDraftMedia
	if m, ok := broadcastState.pendingMedia[adminID]; ok {
		cp := *m
		draftMedia = &cp
	}
	if !exists || !typeExists {
		broadcastState.mu.Unlock()
		lang := update.CallbackQuery.From.LanguageCode
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   h.translation.GetText(lang, "broadcast_session_expired"),
		})
		return
	}
	entCopy := append([]models.MessageEntity(nil), entities...)
	flagsCopy := flags
	broadcastState.mu.Unlock()
	clearBroadcastState(adminID)

	callbackMessage := update.CallbackQuery.Message.Message
	if previewID != 0 {
		_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    adminID,
			MessageID: previewID,
		})
	}
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
	})

	lang := update.CallbackQuery.From.LanguageCode
	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   h.translation.GetText(lang, "broadcast_started_wait"),
	})

	go h.sendBroadcast(ctx, b, adminID, messageText, entCopy, draftMedia, flagsCopy, broadcastType)
}

// BroadcastCancelHandler обрабатывает отмену рассылки
func (h Handler) BroadcastCancelHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.CallbackQuery.From.ID != adminID {
		return
	}

	slog.Info("broadcast cancelled by admin", "adminID", adminID)

	broadcastState.mu.Lock()
	previewID := broadcastState.pendingPreviewMsgID[adminID]
	broadcastState.mu.Unlock()
	clearBroadcastState(adminID)

	lang := update.CallbackQuery.From.LanguageCode

	callbackMessage := update.CallbackQuery.Message.Message
	if previewID != 0 {
		_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    adminID,
			MessageID: previewID,
		})
	}
	if callbackMessage != nil {
		_, err := b.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    callbackMessage.Chat.ID,
			MessageID: callbackMessage.ID,
		})
		if err != nil {
			slog.Warn("error deleting confirmation message", "error", err)
		}
	}

	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   h.translation.GetText(lang, "broadcast_cancelled_msg"),
		ReplyMarkup: models.InlineKeyboardMarkup{InlineKeyboard: [][]models.InlineKeyboardButton{
			{h.translation.WithButton(lang, "back_button", models.InlineKeyboardButton{CallbackData: CallbackAdminPanel})},
		}},
	})
	if err != nil {
		slog.Error("error sending cancel notification", "error", err)
	}
}

// BroadcastBackToAdminHandler возвращает из экрана выбора аудитории рассылки в админ-меню.
func (h Handler) BroadcastBackToAdminHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.CallbackQuery == nil || update.CallbackQuery.From.ID != config.GetAdminTelegramId() {
		return
	}
	cb := update.CallbackQuery
	clearBroadcastState(cb.From.ID)
	if err := h.RenderAdminPanel(ctx, b, cb.Message.Message, cb.From.LanguageCode); err != nil {
		slog.Error("broadcast back to admin", "error", err)
	}
}

// sendBroadcast отправляет сообщение пользователям пачками в зависимости от типа рассылки
func (h Handler) sendBroadcast(ctx context.Context, b *bot.Bot, adminID int64, messageText string, entities []models.MessageEntity, media *broadcastDraftMedia, flags BroadcastRecipientButtons, broadcastType BroadcastType) {
	audience := broadcastTypeToAudience(broadcastType)
	recipients, err := h.customerRepository.GetBroadcastRecipients(ctx, audience)
	if err != nil {
		slog.Error("error getting broadcast recipients", "error", err, "type", broadcastType)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   fmt.Sprintf("❌ Ошибка при получении списка пользователей: %v", err),
		})
		return
	}

	if len(recipients) == 0 {
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   "❌ Нет пользователей для рассылки",
		})
		return
	}

	totalUsers := len(recipients)
	sentCount := 0
	failedCount := 0

	const batchSize = 29
	const delayBetweenBatches = time.Second

	for i := 0; i < totalUsers; i += batchSize {
		end := i + batchSize
		if end > totalUsers {
			end = totalUsers
		}

		batch := recipients[i:end]

		for _, rec := range batch {
			markup := h.buildBroadcastReplyMarkup(rec.Language, flags)
			var err error
			if media != nil {
				if media.AsPhoto {
					pp := &bot.SendPhotoParams{
						ChatID:          rec.TelegramID,
						Photo:           &models.InputFileString{Data: media.FileID},
						Caption:         messageText,
						CaptionEntities: entities,
					}
					if markup != nil {
						pp.ReplyMarkup = markup
					}
					_, err = b.SendPhoto(ctx, pp)
				} else {
					dp := &bot.SendDocumentParams{
						ChatID:          rec.TelegramID,
						Document:        &models.InputFileString{Data: media.FileID},
						Caption:         messageText,
						CaptionEntities: entities,
					}
					if markup != nil {
						dp.ReplyMarkup = markup
					}
					_, err = b.SendDocument(ctx, dp)
				}
			} else {
				params := bot.SendMessageParams{
					ChatID: rec.TelegramID,
					Text:   messageText,
				}
				if len(entities) > 0 {
					params.Entities = entities
				}
				if markup != nil {
					params.ReplyMarkup = markup
				}
				_, err = b.SendMessage(ctx, &params)
			}
			if err != nil {
				slog.Warn("error sending broadcast message", "userId", rec.TelegramID, "error", err)
				failedCount++
			} else {
				sentCount++
			}
		}

		if end < totalUsers {
			time.Sleep(delayBetweenBatches)
		}
	}

	resultText := fmt.Sprintf("✅ Рассылка завершена!\n\n📊 Статистика:\n• Всего пользователей: %d\n• Успешно отправлено: %d\n• Ошибок: %d",
		totalUsers, sentCount, failedCount)

	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   resultText,
	})

	slog.Info("broadcast completed", "totalUsers", totalUsers, "sent", sentCount, "failed", failedCount)
}
