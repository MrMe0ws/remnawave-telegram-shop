package handler

import (
	"context"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

// IsCallbackFromBroadcast — нажата inline-кнопка под постом массовой рассылки (?bc=1).
func IsCallbackFromBroadcast(callbackData string) bool {
	parts := strings.SplitN(callbackData, "?", 2)
	if len(parts) < 2 {
		return false
	}
	for _, p := range strings.Split(parts[1], "&") {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) == 2 && kv[0] == "bc" && kv[1] == "1" {
			return true
		}
	}
	return false
}

// SendOrEditAfterInlineCallback: кнопки рассылки — всегда новое сообщение; иначе правка текущего (или delete+send для медиа без bc).
func SendOrEditAfterInlineCallback(ctx context.Context, b *bot.Bot, u *models.Update, text string, parseMode models.ParseMode, markup models.ReplyMarkup, linkPreview *models.LinkPreviewOptions) error {
	cb := u.CallbackQuery
	if cb == nil || cb.Message.Message == nil {
		return nil
	}
	msg := cb.Message.Message
	if IsCallbackFromBroadcast(cb.Data) {
		p := &bot.SendMessageParams{
			ChatID:      msg.Chat.ID,
			Text:        text,
			ParseMode:   parseMode,
			ReplyMarkup: markup,
		}
		if linkPreview != nil {
			p.LinkPreviewOptions = linkPreview
		}
		_, err := b.SendMessage(ctx, p)
		return err
	}
	_, err := editCallbackOriginToHTMLText(ctx, b, msg, text, parseMode, markup)
	return err
}

// callbackMessageHasMediaLayout — сообщение с фото/документом/видео и т.п., для него нельзя вызвать editMessageText.
func callbackMessageHasMediaLayout(msg *models.Message) bool {
	if msg == nil {
		return false
	}
	return len(msg.Photo) > 0 ||
		msg.Document != nil ||
		msg.Video != nil ||
		msg.Animation != nil ||
		msg.Audio != nil ||
		msg.Voice != nil ||
		msg.VideoNote != nil ||
		msg.Sticker != nil
}

// editCallbackOriginToHTMLText заменяет сообщение, из которого пришёл callback, на HTML-текст с клавиатурой.
// Для медиа-сообщений выполняется deleteMessage + sendMessage (ограничение Telegram Bot API).
func editCallbackOriginToHTMLText(ctx context.Context, b *bot.Bot, msg *models.Message, text string, parseMode models.ParseMode, markup models.ReplyMarkup) (*models.Message, error) {
	if msg == nil {
		return nil, nil
	}
	chatID := msg.Chat.ID
	mid := msg.ID
	if callbackMessageHasMediaLayout(msg) {
		_, _ = b.DeleteMessage(ctx, &bot.DeleteMessageParams{ChatID: chatID, MessageID: mid})
		return b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID:      chatID,
			Text:        text,
			ParseMode:   parseMode,
			ReplyMarkup: markup,
		})
	}
	return b.EditMessageText(ctx, &bot.EditMessageTextParams{
		ChatID:      chatID,
		MessageID:   mid,
		Text:        text,
		ParseMode:   parseMode,
		ReplyMarkup: markup,
	})
}
