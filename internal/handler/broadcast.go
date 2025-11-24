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

// BroadcastState хранит состояние рассылки для каждого админа
type BroadcastState struct {
	mu              sync.Mutex
	pendingText     map[int64]string // adminID -> текст сообщения
	waitingForInput map[int64]bool   // adminID -> ожидается ли ввод текста для рассылки
}

func NewBroadcastState() *BroadcastState {
	return &BroadcastState{
		pendingText:     make(map[int64]string),
		waitingForInput: make(map[int64]bool),
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

	// Устанавливаем флаг, что админ ожидает ввод текста для рассылки
	broadcastState.mu.Lock()
	broadcastState.waitingForInput[adminID] = true
	broadcastState.mu.Unlock()

	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   "📢 Введите сообщение для рассылки всем пользователям:",
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

	// Проверяем, что админ находится в режиме ввода текста для рассылки
	broadcastState.mu.Lock()
	isWaiting, exists := broadcastState.waitingForInput[adminID]
	if !exists || !isWaiting {
		broadcastState.mu.Unlock()
		return // Не обрабатываем сообщение, если админ не в режиме рассылки
	}
	broadcastState.mu.Unlock()

	messageText := update.Message.Text

	// Сохраняем текст сообщения и сбрасываем флаг ожидания ввода
	broadcastState.mu.Lock()
	broadcastState.pendingText[adminID] = messageText
	broadcastState.waitingForInput[adminID] = false // Сбрасываем флаг, так как текст получен
	broadcastState.mu.Unlock()

	// Создаем клавиатуру с кнопками подтверждения
	inlineKeyboard := &models.InlineKeyboardMarkup{
		InlineKeyboard: [][]models.InlineKeyboardButton{
			{
				{Text: "✅ Да, отправить", CallbackData: CallbackBroadcastConfirm},
				{Text: "❌ Нет, отменить", CallbackData: CallbackBroadcastCancel},
			},
		},
	}

	previewText := fmt.Sprintf("📢 Подтвердите отправку рассылки:\n\n%s\n\nОтправить это сообщение всем пользователям?", messageText)

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

	// Получаем сохраненный текст сообщения
	broadcastState.mu.Lock()
	messageText, exists := broadcastState.pendingText[adminID]
	if !exists {
		broadcastState.mu.Unlock()
		_, _ = b.AnswerCallbackQuery(ctx, &bot.AnswerCallbackQueryParams{
			CallbackQueryID: update.CallbackQuery.ID,
			Text:            "Сообщение не найдено. Начните заново с команды /broadcast",
		})
		return
	}
	delete(broadcastState.pendingText, adminID)
	delete(broadcastState.waitingForInput, adminID) // Сбрасываем флаг ожидания
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
	go h.sendBroadcast(ctx, b, adminID, messageText)
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

// sendBroadcast отправляет сообщение всем пользователям пачками
func (h Handler) sendBroadcast(ctx context.Context, b *bot.Bot, adminID int64, messageText string) {
	// Получаем все telegram_id пользователей
	telegramIDs, err := h.customerRepository.GetAllTelegramIds(ctx)
	if err != nil {
		slog.Error("error getting telegram ids for broadcast", "error", err)
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
