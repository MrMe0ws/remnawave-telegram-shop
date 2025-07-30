package handler

import (
	"context"
	"fmt"
	"regexp"
	"remnawave-tg-shop-bot/internal/cache"
	"remnawave-tg-shop-bot/internal/cryptopay"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/payment"
	"remnawave-tg-shop-bot/internal/sync"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/internal/yookasa"
	"strconv"
	"strings"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"

	"remnawave-tg-shop-bot/internal/config"
)

type Handler struct {
	customerRepository *database.CustomerRepository
	purchaseRepository *database.PurchaseRepository
	cryptoPayClient    *cryptopay.Client
	yookasaClient      *yookasa.Client
	translation        *translation.Manager
	paymentService     *payment.PaymentService
	syncService        *sync.SyncService
	referralRepository *database.ReferralRepository
	cache              *cache.Cache
}

func NewHandler(
	syncService *sync.SyncService,
	paymentService *payment.PaymentService,
	translation *translation.Manager,
	customerRepository *database.CustomerRepository,
	purchaseRepository *database.PurchaseRepository,
	cryptoPayClient *cryptopay.Client,
	yookasaClient *yookasa.Client, referralRepository *database.ReferralRepository, cache *cache.Cache) *Handler {
	return &Handler{
		syncService:        syncService,
		paymentService:     paymentService,
		customerRepository: customerRepository,
		purchaseRepository: purchaseRepository,
		cryptoPayClient:    cryptoPayClient,
		yookasaClient:      yookasaClient,
		translation:        translation,
		referralRepository: referralRepository,
		cache:              cache,
	}
}

// ForwardUserMessageToAdmin пересылает все не-командные сообщения пользователей админу
func (h Handler) ForwardUserMessageToAdmin(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil {
		return
	}
	adminID := config.GetAdminTelegramId()
	user := update.Message.From
	text := update.Message.Text
	if user.ID == adminID {
		return // не пересылать админу его же сообщения
	}
	msgText := ""
	if strings.HasPrefix(text, "/") {
		msgText = fmt.Sprintf("@%s (ID: %d):\n%s", user.Username, user.ID, text)
	} else {
		msgText = fmt.Sprintf("@%s (ID: %d):\n%s", user.Username, user.ID, text)
	}
	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   msgText,
	})
	if err != nil {
		// Можно добавить обработку ошибки, если нужно
	}
}

// AdminReplyToUser отправляет ответ админа пользователю, если это reply на пересланное сообщение
func (h Handler) AdminReplyToUser(ctx context.Context, b *bot.Bot, update *models.Update) {
	if update.Message == nil || update.Message.ReplyToMessage == nil {
		return
	}
	adminID := config.GetAdminTelegramId()
	if update.Message.From.ID != adminID {
		return
	}
	// Не отвечать на свои же сообщения
	if update.Message.ReplyToMessage.From != nil && update.Message.ReplyToMessage.From.ID == adminID {
		return
	}
	// Пытаемся извлечь ID пользователя из текста пересланного сообщения через regexp
	origText := update.Message.ReplyToMessage.Text
	re := regexp.MustCompile(`\(ID: (\d+)\)`)
	matches := re.FindStringSubmatch(origText)
	if len(matches) != 2 {
		return
	}
	userID, err := strconv.ParseInt(matches[1], 10, 64)
	if err != nil || userID == 0 {
		return
	}
	_, _ = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: userID,
		Text:   update.Message.Text,
	})
}
