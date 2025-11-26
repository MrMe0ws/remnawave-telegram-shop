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
}

func NewBroadcastState() *BroadcastState {
	return &BroadcastState{
		pendingText:     make(map[int64]string),
		waitingForInput: make(map[int64]bool),
		selectedType:    make(map[int64]BroadcastType),
	}
}

var broadcastState = NewBroadcastState()

// BroadcastCommandHandler обрабатывает команду /broadcast от админа
func (h Handler) BroadcastCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil {
		return
	}

	adminID := config.GetAdminTelegramId()
	if update.Message.From.ID != adminID {
		return
	}

	// Создаем клавиатуру с выбором типа рассылки
	inlineKeyboard := &models.InlineKeyboardMarkup{
		InlineKeyboard: [][]models.InlineKeyboardButton{
			{
				{Text: "🌍 Всем пользователям", CallbackData: CallbackBroadcastAll},
			},
			{
				{Text: "✅ Только активным", CallbackData: CallbackBroadcastActive},
			},
			{
				{Text: "⏰ Неактивным", CallbackData: CallbackBroadcastInactive},
			},
		},
	}

	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:      adminID,
		Text:        "📢 Выберите, для кого отправить сообщение:",
		ReplyMarkup: inlineKeyboard,
	})
	if err != nil {
		slog.Error("error sending broadcast type selection", "error", err)
	}
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

	var broadcastType BroadcastType
	var typeText string

	switch update.CallbackQuery.Data {
	case CallbackBroadcastAll:
		broadcastType = BroadcastTypeAll
		typeText = "всем пользователям"
	case CallbackBroadcastActive:
		broadcastType = BroadcastTypeActive
		typeText = "только активным пользователям"
	case CallbackBroadcastInactive:
		broadcastType = BroadcastTypeInactive
		typeText = "неактивным пользователям"
	default:
		return
	}

	// Сохраняем выбранный тип и устанавливаем флаг ожидания ввода
	broadcastState.mu.Lock()
	broadcastState.selectedType[adminID] = broadcastType
	broadcastState.waitingForInput[adminID] = true
	broadcastState.mu.Unlock()

	// Отвечаем на callback
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: update.CallbackQuery.ID,
		Text:            fmt.Sprintf("Выбрано: %s", typeText),
	})

	// Удаляем сообщение с выбором типа
	callbackMessage := update.CallbackQuery.Message.Message
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
	})

	// Запрашиваем текст сообщения
	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   fmt.Sprintf("📢 Введите сообщение для рассылки %s:", typeText),
	})
	if err != nil {
		slog.Error("error sending broadcast prompt", "error", err)
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

	// Сохраняем текст сообщения и сбрасываем флаг ожидания ввода
	broadcastState.mu.Lock()
	broadcastState.pendingText[adminID] = messageText
	broadcastState.waitingForInput[adminID] = false // Сбрасываем флаг, так как текст получен
	broadcastState.mu.Unlock()

	// Определяем текст для preview в зависимости от типа рассылки
	var targetText string
	switch broadcastType {
	case BroadcastTypeAll:
		targetText = "всем пользователям"
	case BroadcastTypeActive:
		targetText = "только активным пользователям"
	case BroadcastTypeInactive:
		targetText = "неактивным пользователям"
	default:
		targetText = "всем пользователям"
	}

	// Создаем клавиатуру с кнопками подтверждения
	inlineKeyboard := &models.InlineKeyboardMarkup{
		InlineKeyboard: [][]models.InlineKeyboardButton{
			{
				{Text: "✅ Да, отправить", CallbackData: CallbackBroadcastConfirm},
				{Text: "❌ Нет, отменить", CallbackData: CallbackBroadcastCancel},
			},
		},
	}

	previewText := fmt.Sprintf("📢 Подтвердите отправку рассылки:\n\n%s\n\nОтправить это сообщение %s?", messageText, targetText)

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
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: update.CallbackQuery.ID,
			Text:            "Сообщение не найдено. Начните заново с команды /broadcast",
		})
		return
	}
	delete(broadcastState.pendingText, adminID)
	delete(broadcastState.waitingForInput, adminID) // Сбрасываем флаг ожидания
	delete(broadcastState.selectedType, adminID)    // Удаляем выбранный тип
	broadcastState.mu.Unlock()

	// Отвечаем на callback
	_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: update.CallbackQuery.ID,
		Text:            "Рассылка начата...",
	})

	// Удаляем сообщение с подтверждением
	callbackMessage := update.CallbackQuery.Message.Message
	_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
	})

	// Отправляем уведомление о начале рассылки
	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   "🚀 Рассылка начата. Ожидайте завершения...",
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

	// Удаляем сохраненный текст и сбрасываем флаг ожидания
	broadcastState.mu.Lock()
	delete(broadcastState.pendingText, adminID)
	delete(broadcastState.waitingForInput, adminID) // Сбрасываем флаг ожидания
	delete(broadcastState.selectedType, adminID)    // Удаляем выбранный тип
	broadcastState.mu.Unlock()

	// Отвечаем на callback
	_, err := b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
		CallbackQueryID: update.CallbackQuery.ID,
		Text:            "Рассылка отменена",
	})
	if err != nil {
		slog.Error("error answering callback query on cancel", "error", err)
	}

	// Удаляем сообщение с подтверждением
	callbackMessage := update.CallbackQuery.Message.Message
	_, err = b.DeleteMessage(ctx, &bot.DeleteMessageParams{
		ChatID:    callbackMessage.Chat.ID,
		MessageID: callbackMessage.ID,
	})
	if err != nil {
		slog.Warn("error deleting confirmation message", "error", err)
	}

	// Отправляем уведомление об отмене
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   "❌ Рассылка отменена",
	})
	if err != nil {
		slog.Error("error sending cancel notification", "error", err)
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
