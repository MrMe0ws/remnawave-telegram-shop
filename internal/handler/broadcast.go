package handler

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
)

// BroadcastType определяет тип рассылки
type BroadcastType string

const (
	BroadcastTypeAll      BroadcastType = "all"      // Всем пользователям
	BroadcastTypeActive   BroadcastType = "active"   // Только активным
	BroadcastTypeInactive BroadcastType = "inactive" // Неактивным
)

// BroadcastState хранит состояние рассылки для каждого админа
type BroadcastState struct {
	mu              sync.Mutex
	pendingText     map[int64]string        // adminID -> текст сообщения
	waitingForInput map[int64]bool          // adminID -> ожидается ли ввод текста для рассылки
	selectedType    map[int64]BroadcastType // adminID -> выбранный тип рассылки
	promptMessageID map[int64]int           // adminID -> id сообщения с подсказкой «введите текст» (удалить после ввода)
}

func NewBroadcastState() *BroadcastState {
	return &BroadcastState{
		pendingText:     make(map[int64]string),
		waitingForInput: make(map[int64]bool),
		selectedType:    make(map[int64]BroadcastType),
		promptMessageID: make(map[int64]int),
	}
}

func clearBroadcastState(adminID int64) {
	broadcastState.mu.Lock()
	delete(broadcastState.pendingText, adminID)
	delete(broadcastState.waitingForInput, adminID)
	delete(broadcastState.selectedType, adminID)
	delete(broadcastState.promptMessageID, adminID)
	broadcastState.mu.Unlock()
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

var broadcastState = NewBroadcastState()

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

	lang := update.Message.From.LanguageCode
	_ = h.SendBroadcastTypeSelection(ctx, b, adminID, lang)
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

	// Сохраняем выбранный тип и устанавливаем флаг ожидания ввода
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

// BroadcastMessageHandler обрабатывает текстовое сообщение от админа после команды /broadcast
func (h Handler) BroadcastMessageHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil || update.Message.Text == "" {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.Message.From.ID != adminID {
		return
	}

	// Пропускаем команды
	if update.Message.Text[0] == '/' {
		return
	}

	// Проверяем, что админ находится в режиме ввода текста для рассылки и выбран тип
	broadcastState.mu.Lock()
	isWaiting, exists := broadcastState.waitingForInput[adminID]
	broadcastType, typeExists := broadcastState.selectedType[adminID]
	if !exists || !isWaiting || !typeExists {
		broadcastState.mu.Unlock()
		return // Не обрабатываем сообщение, если админ не в режиме рассылки или тип не выбран
	}
	broadcastState.mu.Unlock()

	messageText := update.Message.Text

	lang := update.Message.From.LanguageCode

	// Сохраняем текст сообщения и сбрасываем флаг ожидания ввода
	broadcastState.mu.Lock()
	broadcastState.pendingText[adminID] = messageText
	broadcastState.waitingForInput[adminID] = false // Сбрасываем флаг, так как текст получен
	promptMid := broadcastState.promptMessageID[adminID]
	delete(broadcastState.promptMessageID, adminID)
	broadcastState.mu.Unlock()

	if promptMid != 0 {
		_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    adminID,
			MessageID: promptMid,
		})
	}

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
	previewText := fmt.Sprintf(h.translation.GetText(lang, "broadcast_confirm_preview"), messageText, targetText)

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
		Text:        previewText,
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

	// Получаем сохраненный текст сообщения и тип рассылки
	broadcastState.mu.Lock()
	messageText, exists := broadcastState.pendingText[adminID]
	broadcastType, typeExists := broadcastState.selectedType[adminID]
	if !exists || !typeExists {
		broadcastState.mu.Unlock()
		lang := update.CallbackQuery.From.LanguageCode
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   h.translation.GetText(lang, "broadcast_session_expired"),
		})
		return
	}
	broadcastState.mu.Unlock()
	clearBroadcastState(adminID)

	// Удаляем сообщение с подтверждением
	callbackMessage := update.CallbackQuery.Message.Message
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
	})

	lang := update.CallbackQuery.From.LanguageCode
	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   h.translation.GetText(lang, "broadcast_started_wait"),
	})

	// Запускаем рассылку в отдельной горутине
	go h.sendBroadcast(ctx, b, adminID, messageText, broadcastType)
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

	clearBroadcastState(adminID)

	lang := update.CallbackQuery.From.LanguageCode

	callbackMessage := update.CallbackQuery.Message.Message
	_, err := b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
	})
	if err != nil {
		slog.Warn("error deleting confirmation message", "error", err)
	}

	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
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
func (h Handler) sendBroadcast(ctx context.Context, b *bot.Bot, adminID int64, messageText string, broadcastType BroadcastType) {
	// Получаем telegram_id пользователей в зависимости от типа рассылки
	var telegramIDs []int64
	var err error

	switch broadcastType {
	case BroadcastTypeAll:
		telegramIDs, err = h.customerRepository.GetAllTelegramIds(ctx)
	case BroadcastTypeActive:
		telegramIDs, err = h.customerRepository.GetActiveTelegramIds(ctx)
	case BroadcastTypeInactive:
		telegramIDs, err = h.customerRepository.GetInactiveTelegramIds(ctx)
	default:
		telegramIDs, err = h.customerRepository.GetAllTelegramIds(ctx)
	}

	if err != nil {
		slog.Error("error getting telegram ids for broadcast", "error", err, "type", broadcastType)
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   fmt.Sprintf("❌ Ошибка при получении списка пользователей: %v", err),
		})
		return
	}

	if len(telegramIDs) == 0 {
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   "❌ Нет пользователей для рассылки",
		})
		return
	}

	totalUsers := len(telegramIDs)
	sentCount := 0
	failedCount := 0

	// Константы для лимитов Telegram API
	const batchSize = 29                    // Отправляем по 29 сообщений за раз (меньше лимита в 30)
	const delayBetweenBatches = time.Second // Задержка между пачками - 1 секунда

	// Отправляем сообщения пачками
	for i := 0; i < totalUsers; i += batchSize {
		end := i + batchSize
		if end > totalUsers {
			end = totalUsers
		}

		batch := telegramIDs[i:end]

		// Отправляем пачку сообщений
		for _, userID := range batch {
			_, err := b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID: userID,
				Text:   messageText,
			})
			if err != nil {
				slog.Warn("error sending broadcast message", "userId", userID, "error", err)
				failedCount++
			} else {
				sentCount++
			}
		}

		// Если это не последняя пачка, ждем перед следующей
		if end < totalUsers {
			time.Sleep(delayBetweenBatches)
		}
	}

	// Отправляем итоговый отчет админу
	resultText := fmt.Sprintf("✅ Рассылка завершена!\n\n📊 Статистика:\n• Всего пользователей: %d\n• Успешно отправлено: %d\n• Ошибок: %d",
		totalUsers, sentCount, failedCount)

	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   resultText,
	})

	slog.Info("broadcast completed", "totalUsers", totalUsers, "sent", sentCount, "failed", failedCount)
}
