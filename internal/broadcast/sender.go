package broadcast

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/utils"
)

const (
	batchSize             = 29
	delayBetweenBatches   = time.Second
	adminResultMessageFmt = "✅ Рассылка завершена!\n\n📊 Статистика:\n• Всего пользователей: %d\n• Успешно отправлено: %d\n• Ошибок: %d"
)

// Sender отправляет массовые сообщения через Telegram-бота.
type Sender struct {
	customers *database.CustomerRepository
	tm        *translation.Manager
}

func NewSender(customers *database.CustomerRepository, tm *translation.Manager) *Sender {
	return &Sender{customers: customers, tm: tm}
}

// Send рассылает сообщение выбранной аудитории. При adminID != 0 шлёт итог админу в Telegram.
func (s *Sender) Send(
	ctx context.Context,
	b *bot.Bot,
	adminID int64,
	audience string,
	tariffID *int64,
	messageText string,
	entities []models.MessageEntity,
	media *Media,
	flags RecipientButtons,
) SendResult {
	result := SendResult{}
	if s == nil || s.customers == nil || b == nil {
		return result
	}

	recipients, err := s.customers.GetBroadcastRecipients(ctx, audience, tariffID)
	if err != nil {
		slog.Error("broadcast: get recipients", "error", err, "audience", audience)
		if adminID != 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID: adminID,
				Text:   fmt.Sprintf("❌ Ошибка при получении списка пользователей: %v", err),
			})
		}
		return result
	}

	if len(recipients) == 0 {
		if adminID != 0 {
			_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
				ChatID: adminID,
				Text:   "❌ Нет пользователей для рассылки",
			})
		}
		return result
	}

	totalUsers := len(recipients)
	eligibleUsers := 0
	for _, rec := range recipients {
		if !utils.IsSyntheticTelegramID(rec.TelegramID) {
			eligibleUsers++
		}
	}
	sentCount := 0
	failedCount := 0

	for i := 0; i < totalUsers; i += batchSize {
		end := i + batchSize
		if end > totalUsers {
			end = totalUsers
		}

		batch := recipients[i:end]
		for _, rec := range batch {
			if utils.IsSyntheticTelegramID(rec.TelegramID) {
				continue
			}
			markup := BuildReplyMarkup(s.tm, rec.Language, flags)
			var sendErr error
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
					_, sendErr = b.SendPhoto(ctx, pp)
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
					_, sendErr = b.SendDocument(ctx, dp)
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
				_, sendErr = b.SendMessage(ctx, &params)
			}
			if sendErr != nil {
				slog.Warn("broadcast: send message", "userId", rec.TelegramID, "error", sendErr)
				failedCount++
			} else {
				sentCount++
			}
		}

		if end < totalUsers {
			time.Sleep(delayBetweenBatches)
		}
	}

	result = SendResult{
		TotalUsers:  eligibleUsers,
		SentCount:   sentCount,
		FailedCount: failedCount,
	}

	if adminID != 0 {
		_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: adminID,
			Text:   fmt.Sprintf(adminResultMessageFmt, eligibleUsers, sentCount, failedCount),
		})
	}

	slog.Info("broadcast completed",
		"totalUsers", totalUsers,
		"eligibleUsers", eligibleUsers,
		"sent", sentCount,
		"failed", failedCount,
		"audience", audience,
	)
	return result
}
