package payment

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"remnawave-tg-shop-bot/internal/cache"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/cryptopay"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/moynalog"
	"remnawave-tg-shop-bot/internal/promo"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/internal/translation"
	"remnawave-tg-shop-bot/internal/yookasa"
	"remnawave-tg-shop-bot/utils"
	"time"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

type PaymentService struct {
	purchaseRepository *database.PurchaseRepository
	remnawaveClient    *remnawave.Client
	customerRepository *database.CustomerRepository
	telegramBot        *bot.Bot
	translation        *translation.Manager
	cryptoPayClient    *cryptopay.Client
	yookasaClient      *yookasa.Client
	referralRepository *database.ReferralRepository
	cache              *cache.Cache
	moynalogClient     *moynalog.Client
	promoService       *promo.Service
}

// PromoMeta attaches an activated percent discount to a new purchase row (optional).
type PromoMeta struct {
	PromoCodeID            *int64
	DiscountPercentApplied *int
}

func NewPaymentService(
	translation *translation.Manager,
	purchaseRepository *database.PurchaseRepository,
	remnawaveClient *remnawave.Client,
	customerRepository *database.CustomerRepository,
	telegramBot *bot.Bot,
	cryptoPayClient *cryptopay.Client,
	yookasaClient *yookasa.Client,
	referralRepository *database.ReferralRepository,
	cache *cache.Cache,
	moynalogClient *moynalog.Client,
	promoService *promo.Service,
) *PaymentService {
	return &PaymentService{
		purchaseRepository: purchaseRepository,
		remnawaveClient:    remnawaveClient,
		customerRepository: customerRepository,
		telegramBot:        telegramBot,
		translation:        translation,
		cryptoPayClient:    cryptoPayClient,
		yookasaClient:      yookasaClient,
		referralRepository: referralRepository,
		cache:              cache,
		moynalogClient:     moynalogClient,
		promoService:       promoService,
	}
}

func (s PaymentService) ProcessPurchaseById(ctx context.Context, purchaseId int64) error {
	purchase, err := s.purchaseRepository.FindById(ctx, purchaseId)
	if err != nil {
		return err
	}
	if purchase == nil {
		return fmt.Errorf("purchase with crypto invoice id %s not found", utils.MaskHalfInt64(purchaseId))
	}

	customer, err := s.customerRepository.FindById(ctx, purchase.CustomerID)
	if err != nil {
		return err
	}
	if customer == nil {
		return fmt.Errorf("customer %s not found", utils.MaskHalfInt64(purchase.CustomerID))
	}

	if messageId, b := s.cache.Get(purchase.ID); b {
		_, err = s.telegramBot.DeleteMessage(ctx, &bot.DeleteMessageParams{
			ChatID:    customer.TelegramID,
			MessageID: messageId,
		})
		if err != nil {
			slog.Error("Error deleting message", err)
		}
	}

	if purchase.Month <= 0 && purchase.ExtraHwid > 0 {
		return s.processDevicePurchase(ctx, purchase, customer)
	}

	daysToAdd := purchase.Month * config.DaysInMonth()
	useFromNow := !config.TrialAddsToPaid() && customer.ExpireAt != nil && customer.ExpireAt.After(time.Now())
	if useFromNow {
		paidCount, err := s.purchaseRepository.CountPaidSubscriptionsByCustomer(ctx, customer.ID)
		if err != nil {
			return err
		}
		if paidCount == 0 {
			user, err := s.remnawaveClient.CreateOrUpdateUserFromNow(ctx, customer.ID, customer.TelegramID, config.TrafficLimit(), daysToAdd, false)
			if err != nil {
				return err
			}
			if err := s.finalizePurchase(ctx, purchase, customer, user); err != nil {
				return err
			}
			return s.applyExtraAfterSubscription(ctx, customer, user, purchase)
		}
	}
	user, err := s.remnawaveClient.CreateOrUpdateUser(ctx, customer.ID, customer.TelegramID, config.TrafficLimit(), daysToAdd, false)
	if err != nil {
		return err
	}
	if err := s.finalizePurchase(ctx, purchase, customer, user); err != nil {
		return err
	}
	return s.applyExtraAfterSubscription(ctx, customer, user, purchase)
}

func (s PaymentService) processDevicePurchase(ctx context.Context, purchase *database.Purchase, customer *database.Customer) error {
	err := s.purchaseRepository.MarkAsPaid(ctx, purchase.ID)
	if err != nil {
		return err
	}

	userInfo, err := s.remnawaveClient.GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		return err
	}

	currentExtra := 0
	if customer.ExtraHwid > 0 && customer.ExtraHwidExpiresAt != nil && customer.ExtraHwidExpiresAt.After(time.Now()) {
		currentExtra = customer.ExtraHwid
	} else if customer.ExtraHwid > 0 && customer.ExtraHwidExpiresAt != nil && customer.ExtraHwidExpiresAt.Before(time.Now()) {
		newLimit := config.GetHwidFallbackDeviceLimit()
		if newLimit < 1 {
			newLimit = 1
		}
		if _, err := s.remnawaveClient.UpdateUserDeviceLimit(ctx, customer.TelegramID, newLimit); err != nil {
			return err
		}
		if err := s.customerRepository.UpdateFields(ctx, customer.ID, map[string]interface{}{
			"extra_hwid":            0,
			"extra_hwid_expires_at": nil,
		}); err != nil {
			return err
		}
		currentExtra = 0
	}

	currentLimit := resolveDeviceLimit(userInfo)
	newLimit := currentLimit + purchase.ExtraHwid
	maxLimit := config.HwidMaxDevices()
	if maxLimit > 0 && newLimit > maxLimit {
		newLimit = maxLimit
	}

	updatedUser, err := s.remnawaveClient.UpdateUserDeviceLimit(ctx, customer.TelegramID, newLimit)
	if err != nil {
		return err
	}

	newExtra := currentExtra + purchase.ExtraHwid
	if customer.ExpireAt == nil {
		return fmt.Errorf("subscription expire_at is not set")
	}
	if err := s.customerRepository.UpdateFields(ctx, customer.ID, map[string]interface{}{
		"extra_hwid":            newExtra,
		"extra_hwid_expires_at": customer.ExpireAt,
	}); err != nil {
		return err
	}

	if s.moynalogClient != nil && purchase.InvoiceType == database.InvoiceTypeYookasa {
		description := fmt.Sprintf("Оплата подписки +%d", purchase.ExtraHwid)
		slog.Info("Sending receipt to moynalog", "purchase_id", utils.MaskHalfInt64(purchase.ID), "amount", purchase.Amount, "description", description)
		if err := s.moynalogClient.CreateIncome(ctx, purchase.Amount, description); err != nil {
			slog.Error("Failed to send receipt to moynalog", "error", err, "purchase_id", utils.MaskHalfInt64(purchase.ID))
			notifyAdminMoynalogFailure(ctx, s.telegramBot, config.GetAdminTelegramId(), purchase, err, description)
		}
	}

	if updatedUser != nil {
		customerFilesToUpdate := map[string]interface{}{
			"subscription_link": updatedUser.SubscriptionUrl,
			"expire_at":         updatedUser.ExpireAt,
		}
		if err := s.customerRepository.UpdateFields(ctx, customer.ID, customerFilesToUpdate); err != nil {
			return err
		}
	}

	successText := fmt.Sprintf(s.translation.GetText(customer.Language, "hwid_change_success_paid"), currentLimit, newLimit, int(math.Ceil(purchase.Amount)))
	_, err = s.telegramBot.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: customer.TelegramID,
		Text:   successText,
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: s.createConnectKeyboard(customer),
		},
	})
	if err != nil {
		return err
	}
	s.clearPromoDiscountIfUsed(ctx, purchase, customer)
	return nil
}

func (s PaymentService) applyExtraAfterSubscription(ctx context.Context, customer *database.Customer, user *remnawave.User, purchase *database.Purchase) error {
	if customer == nil || user == nil || purchase == nil {
		return nil
	}
	if purchase.Month <= 0 {
		return nil
	}

	userInfo, err := s.remnawaveClient.GetUserTrafficInfo(ctx, customer.TelegramID)
	if err != nil {
		return err
	}

	currentLimit := resolveDeviceLimit(userInfo)
	activeExtra := 0
	if customer.ExtraHwid > 0 && customer.ExtraHwidExpiresAt != nil && customer.ExtraHwidExpiresAt.After(time.Now()) {
		activeExtra = customer.ExtraHwid
	}

	newExtra := purchase.ExtraHwid
	if newExtra < 0 {
		newExtra = 0
	}

	paidBaseLimit := config.PaidHwidLimit()
	if paidBaseLimit <= 0 {
		paidBaseLimit = config.GetHwidFallbackDeviceLimit()
	}
	if activeExtra == 0 && newExtra == 0 && paidBaseLimit > 0 && currentLimit > 0 && currentLimit < paidBaseLimit {
		if _, err := s.remnawaveClient.UpdateUserDeviceLimit(ctx, customer.TelegramID, paidBaseLimit); err != nil {
			return err
		}
		currentLimit = paidBaseLimit
	}
	baseLimit := currentLimit - activeExtra
	if baseLimit < 1 {
		baseLimit = 1
	}
	newLimit := baseLimit + newExtra
	maxLimit := config.HwidMaxDevices()
	if maxLimit > 0 && newLimit > maxLimit {
		newLimit = maxLimit
	}
	if activeExtra > 0 && newExtra == 0 {
		newLimit = config.GetHwidFallbackDeviceLimit()
		if newLimit < 1 {
			newLimit = 1
		}
	}

	if activeExtra > 0 || newExtra > 0 {
		if _, err := s.remnawaveClient.UpdateUserDeviceLimit(ctx, customer.TelegramID, newLimit); err != nil {
			return err
		}
	}

	updates := map[string]interface{}{
		"extra_hwid":            newExtra,
		"extra_hwid_expires_at": nil,
	}
	if newExtra > 0 {
		updates["extra_hwid_expires_at"] = user.ExpireAt
	}
	return s.customerRepository.UpdateFields(ctx, customer.ID, updates)
}

func resolveDeviceLimit(userInfo *remnawave.User) int {
	if userInfo != nil && userInfo.HwidDeviceLimit != nil && *userInfo.HwidDeviceLimit > 0 {
		return *userInfo.HwidDeviceLimit
	}
	fallback := config.GetHwidFallbackDeviceLimit()
	if fallback <= 0 {
		return 1
	}
	return fallback
}

func (s PaymentService) finalizePurchase(ctx context.Context, purchase *database.Purchase, customer *database.Customer, user *remnawave.User) error {
	err := s.purchaseRepository.MarkAsPaid(ctx, purchase.ID)
	if err != nil {
		return err
	}

	// Отправка чека в МойНалог для платежей YooKassa (сразу после подтверждения платежа)
	if s.moynalogClient != nil && purchase.InvoiceType == database.InvoiceTypeYookasa {
		slog.Debug("Attempting to send moynalog receipt", "invoice_type", purchase.InvoiceType, "purchase_id", utils.MaskHalfInt64(purchase.ID))

		var monthString string
		switch purchase.Month {
		case 1:
			monthString = "месяц"
		case 2, 3, 4:
			monthString = "месяца"
		default:
			monthString = "месяцев"
		}

		description := fmt.Sprintf("Подписка на %d %s", purchase.Month, monthString)

		slog.Info("Sending receipt to moynalog", "purchase_id", utils.MaskHalfInt64(purchase.ID), "amount", purchase.Amount, "description", description)

		if err := s.moynalogClient.CreateIncome(ctx, purchase.Amount, description); err != nil {
			slog.Error("Failed to send receipt to moynalog", "error", err, "purchase_id", utils.MaskHalfInt64(purchase.ID))
			notifyAdminMoynalogFailure(ctx, s.telegramBot, config.GetAdminTelegramId(), purchase, err, description)
			// Не прерываем обработку покупки при ошибке отправки чека
		} else {
			slog.Info("Receipt sent to moynalog successfully", "purchase_id", utils.MaskHalfInt64(purchase.ID))
		}
	} else {
		if s.moynalogClient == nil {
			slog.Debug("Moynalog client not available, skipping receipt", "purchase_id", utils.MaskHalfInt64(purchase.ID))
		} else if purchase.InvoiceType != database.InvoiceTypeYookasa {
			slog.Debug("Invoice type is not YooKassa, skipping moynalog receipt", "invoice_type", purchase.InvoiceType, "purchase_id", utils.MaskHalfInt64(purchase.ID))
		}
	}

	customerFilesToUpdate := map[string]interface{}{
		"subscription_link": user.SubscriptionUrl,
		"expire_at":         user.ExpireAt,
	}

	err = s.customerRepository.UpdateFields(ctx, customer.ID, customerFilesToUpdate)
	if err != nil {
		return err
	}

	_, err = s.telegramBot.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: customer.TelegramID,
		Text:   s.translation.GetText(customer.Language, "subscription_activated"),
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: s.createConnectKeyboard(customer),
		},
	})
	if err != nil {
		return err
	}

	if err := s.applyReferralBonus(ctx, purchase, customer); err != nil {
		return err
	}
	s.clearPromoDiscountIfUsed(ctx, purchase, customer)
	slog.Info("purchase processed", "purchase_id", utils.MaskHalfInt64(purchase.ID), "type", purchase.InvoiceType, "customer_id", utils.MaskHalfInt64(customer.ID))

	return nil
}

func (s *PaymentService) clearPromoDiscountIfUsed(ctx context.Context, purchase *database.Purchase, customer *database.Customer) {
	if s.promoService == nil || purchase == nil || customer == nil {
		return
	}
	if purchase.PromoCodeID != nil && *purchase.PromoCodeID > 0 {
		_ = s.promoService.ClearPendingDiscountAfterSuccessfulSubscriptionPayment(ctx, customer.ID)
	}
}

func (s PaymentService) createConnectKeyboard(customer *database.Customer) [][]models.InlineKeyboardButton {
	var inlineCustomerKeyboard [][]models.InlineKeyboardButton

	// Кнопка "Мой VPN" всегда открывает подменю подключения
	// В подменю кнопка "подключить устройство" будет использовать MINI_APP_URL если он указан
	inlineCustomerKeyboard = append(inlineCustomerKeyboard, []models.InlineKeyboardButton{
		s.translation.WithButton(customer.Language, "connect_button", models.InlineKeyboardButton{CallbackData: "connect"}),
	})

	inlineCustomerKeyboard = append(inlineCustomerKeyboard, []models.InlineKeyboardButton{
		s.translation.WithButton(customer.Language, "back_button", models.InlineKeyboardButton{CallbackData: "start"}),
	})
	return inlineCustomerKeyboard
}

func (s PaymentService) applyReferralBonus(ctx context.Context, purchase *database.Purchase, customer *database.Customer) error {
	ctxReferee := context.Background()
	referral, err := s.referralRepository.FindByReferee(ctxReferee, customer.TelegramID)
	if err != nil || referral == nil {
		return err
	}

	mode := config.ReferralMode()
	if mode == "progressive" {
		return s.applyProgressiveReferralBonus(ctxReferee, referral, purchase, customer)
	}
	return s.applyDefaultReferralBonus(ctxReferee, referral)
}

func (s PaymentService) applyDefaultReferralBonus(ctx context.Context, referral *database.Referral) error {
	if referral.BonusGranted {
		return nil
	}

	referrerCustomer, err := s.customerRepository.FindByTelegramId(ctx, referral.ReferrerID)
	if err != nil || referrerCustomer == nil {
		return err
	}

	bonusDays := config.GetReferralDays()
	if err := s.grantReferralDays(ctx, referrerCustomer, bonusDays); err != nil {
		return err
	}
	if err := s.referralRepository.MarkBonusGranted(ctx, referral.ID); err != nil {
		return err
	}

	slog.Info("Granted referral bonus", "customer_id", utils.MaskHalfInt64(referrerCustomer.ID))
	err = s.sendReferralBonusMessage(ctx, referrerCustomer, bonusDays)
	return err
}

func (s PaymentService) applyProgressiveReferralBonus(ctx context.Context, referral *database.Referral, purchase *database.Purchase, customer *database.Customer) error {
	if purchase.Month < 1 {
		return nil
	}

	paidCount, err := s.purchaseRepository.CountPaidSubscriptionsByCustomer(ctx, customer.ID)
	if err != nil {
		return err
	}

	referrerCustomer, err := s.customerRepository.FindByTelegramId(ctx, referral.ReferrerID)
	if err != nil || referrerCustomer == nil {
		return err
	}

	bonusDays := 0
	if paidCount == 1 {
		refereeBonusDays := config.ReferralFirstRefereeDays()
		if err := s.grantReferralDays(ctx, customer, refereeBonusDays); err != nil {
			return err
		}
		if err := s.sendReferralFirstBonusMessage(ctx, customer, refereeBonusDays); err != nil {
			return err
		}
		bonusDays = config.ReferralFirstReferrerDays()
		if err := s.grantReferralDays(ctx, referrerCustomer, bonusDays); err != nil {
			return err
		}
		if !referral.BonusGranted {
			if err := s.referralRepository.MarkBonusGranted(ctx, referral.ID); err != nil {
				return err
			}
		}
	} else {
		bonusDays = config.ReferralRepeatReferrerDays()
		if err := s.grantReferralDays(ctx, referrerCustomer, bonusDays); err != nil {
			return err
		}
		if !referral.BonusGranted {
			if err := s.referralRepository.MarkBonusGranted(ctx, referral.ID); err != nil {
				return err
			}
		}
	}

	slog.Info("Granted referral bonus", "customer_id", utils.MaskHalfInt64(referrerCustomer.ID))
	if bonusDays <= 0 {
		return nil
	}
	err = s.sendReferralBonusMessage(ctx, referrerCustomer, bonusDays)
	return err
}

func (s PaymentService) grantReferralDays(ctx context.Context, customer *database.Customer, days int) error {
	if days <= 0 {
		return nil
	}
	user, err := s.remnawaveClient.CreateOrUpdateUser(ctx, customer.ID, customer.TelegramID, config.TrafficLimit(), days, false)
	if err != nil {
		return err
	}
	updates := map[string]interface{}{
		"subscription_link": user.SubscriptionUrl,
		"expire_at":         user.ExpireAt,
	}
	return s.customerRepository.UpdateFields(ctx, customer.ID, updates)
}

func (s PaymentService) sendReferralBonusMessage(ctx context.Context, customer *database.Customer, days int) error {
	if days <= 0 {
		return nil
	}
	_, err := s.telegramBot.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    customer.TelegramID,
		ParseMode: models.ParseModeHTML,
		Text:      fmt.Sprintf(s.translation.GetText(customer.Language, "referral_bonus_granted"), days),
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: s.createReferralBonusKeyboard(customer),
		},
	})
	return err
}

func (s PaymentService) sendReferralFirstBonusMessage(ctx context.Context, customer *database.Customer, days int) error {
	if days <= 0 {
		return nil
	}
	_, err := s.telegramBot.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    customer.TelegramID,
		ParseMode: models.ParseModeHTML,
		Text:      fmt.Sprintf(s.translation.GetText(customer.Language, "referral_first_bonus_granted"), days),
		ReplyMarkup: models.InlineKeyboardMarkup{
			InlineKeyboard: s.createReferralBonusKeyboard(customer),
		},
	})
	return err
}

func (s PaymentService) createReferralBonusKeyboard(customer *database.Customer) [][]models.InlineKeyboardButton {
	return [][]models.InlineKeyboardButton{
		{
			s.translation.WithButton(customer.Language, "referral_button", models.InlineKeyboardButton{CallbackData: "referral"}),
		},
		{
			s.translation.WithButton(customer.Language, "connect_button", models.InlineKeyboardButton{CallbackData: "connect"}),
		},
	}
}

func (s PaymentService) CreatePurchase(ctx context.Context, amount float64, months int, customer *database.Customer, invoiceType database.InvoiceType, meta *PromoMeta) (url string, purchaseId int64, err error) {
	switch invoiceType {
	case database.InvoiceTypeCrypto:
		return s.createCryptoInvoice(ctx, amount, months, 0, customer, meta)
	case database.InvoiceTypeYookasa:
		return s.createYookasaInvoice(ctx, amount, months, 0, customer, meta)
	case database.InvoiceTypeTelegram:
		return s.createTelegramInvoice(ctx, amount, months, 0, customer, meta)
	case database.InvoiceTypeTribute:
		return s.createTributeInvoice(ctx, amount, months, 0, customer, nil)
	default:
		return "", 0, fmt.Errorf("unknown invoice type: %s", invoiceType)
	}
}

func (s PaymentService) CreatePurchaseWithExtra(ctx context.Context, amount float64, months int, extraHwid int, customer *database.Customer, invoiceType database.InvoiceType, meta *PromoMeta) (url string, purchaseId int64, err error) {
	if extraHwid < 0 {
		return "", 0, fmt.Errorf("invalid extra hwid: %d", extraHwid)
	}
	switch invoiceType {
	case database.InvoiceTypeCrypto:
		return s.createCryptoInvoice(ctx, amount, months, extraHwid, customer, meta)
	case database.InvoiceTypeYookasa:
		return s.createYookasaInvoice(ctx, amount, months, extraHwid, customer, meta)
	case database.InvoiceTypeTelegram:
		return s.createTelegramInvoice(ctx, amount, months, extraHwid, customer, meta)
	case database.InvoiceTypeTribute:
		return s.createTributeInvoice(ctx, amount, months, extraHwid, customer, nil)
	default:
		return "", 0, fmt.Errorf("unknown invoice type: %s", invoiceType)
	}
}

func (s PaymentService) CreateHwidPurchase(ctx context.Context, amount float64, extraHwid int, customer *database.Customer, invoiceType database.InvoiceType, meta *PromoMeta) (url string, purchaseId int64, err error) {
	if extraHwid <= 0 {
		return "", 0, fmt.Errorf("invalid extra hwid: %d", extraHwid)
	}
	switch invoiceType {
	case database.InvoiceTypeCrypto:
		return s.createCryptoInvoice(ctx, amount, 0, extraHwid, customer, meta)
	case database.InvoiceTypeYookasa:
		return s.createYookasaInvoice(ctx, amount, 0, extraHwid, customer, meta)
	case database.InvoiceTypeTelegram:
		return s.createTelegramInvoice(ctx, amount, 0, extraHwid, customer, meta)
	case database.InvoiceTypeTribute:
		return s.createTributeInvoice(ctx, amount, 0, extraHwid, customer, nil)
	default:
		return "", 0, fmt.Errorf("unknown invoice type: %s", invoiceType)
	}
}

var ErrCustomerNotFound = errors.New("customer not found")

func (s PaymentService) CancelTributePurchase(ctx context.Context, telegramId int64) error {
	slog.Info("Canceling tribute purchase", "telegram_id", utils.MaskHalfInt64(telegramId))
	customer, err := s.customerRepository.FindByTelegramId(ctx, telegramId)
	if err != nil {
		return err
	}
	if customer == nil {
		return ErrCustomerNotFound
	}
	tributePurchase, err := s.purchaseRepository.FindByCustomerIDAndInvoiceTypeLast(ctx, customer.ID, database.InvoiceTypeTribute)
	if err != nil {
		return err
	}
	if tributePurchase == nil {
		return errors.New("tribute purchase not found")
	}
	expireAt, err := s.remnawaveClient.DecreaseSubscription(ctx, telegramId, config.TrafficLimit(), -tributePurchase.Month*config.DaysInMonth())
	if err != nil {
		return err
	}

	if err := s.customerRepository.UpdateFields(ctx, customer.ID, map[string]interface{}{
		"expire_at": expireAt,
	}); err != nil {
		return err
	}

	if err := s.purchaseRepository.UpdateFields(ctx, tributePurchase.ID, map[string]interface{}{
		"status": database.PurchaseStatusCancel,
	}); err != nil {
		return err
	}
	_, err = s.telegramBot.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    telegramId,
		ParseMode: models.ParseModeHTML,
		Text:      s.translation.GetText(customer.Language, "tribute_cancelled"),
	})
	if err != nil {
		slog.Error("Error sending message about tribute cancelled", err, "telegram_id", utils.MaskHalfInt64(telegramId))
	}
	slog.Info("Canceled tribute purchase", "purchase_id", utils.MaskHalfInt64(tributePurchase.ID), "telegram_id", utils.MaskHalfInt64(telegramId))
	return nil
}

func (s PaymentService) createCryptoInvoice(ctx context.Context, amount float64, months int, extraHwid int, customer *database.Customer, meta *PromoMeta) (url string, purchaseId int64, err error) {
	pur := &database.Purchase{
		InvoiceType: database.InvoiceTypeCrypto,
		Status:      database.PurchaseStatusNew,
		Amount:      amount,
		Currency:    "RUB",
		CustomerID:  customer.ID,
		Month:       months,
		ExtraHwid:   extraHwid,
	}
	if meta != nil {
		pur.PromoCodeID = meta.PromoCodeID
		pur.DiscountPercentApplied = meta.DiscountPercentApplied
	}
	purchaseId, err = s.purchaseRepository.Create(ctx, pur)
	if err != nil {
		slog.Error("Error creating purchase", err)
		return "", 0, err
	}

	username, _ := ctx.Value(remnawave.CtxKeyUsername).(string)
	description := fmt.Sprintf("Subscription on %d month", months)
	if extraHwid > 0 {
		description = fmt.Sprintf("Extra devices +%d", extraHwid)
	}
	invoice, err := s.cryptoPayClient.CreateInvoice(&cryptopay.InvoiceRequest{
		CurrencyType:   "fiat",
		Fiat:           "RUB",
		Amount:         fmt.Sprintf("%d", int(amount)),
		AcceptedAssets: "USDT",
		Payload:        fmt.Sprintf("purchaseId=%d&username=%s", purchaseId, username),
		Description:    description,
		PaidBtnName:    "callback",
		PaidBtnUrl:     config.BotURL(),
	})
	if err != nil {
		slog.Error("Error creating invoice", err)
		return "", 0, err
	}

	updates := map[string]interface{}{
		"crypto_invoice_url": invoice.BotInvoiceUrl,
		"crypto_invoice_id":  invoice.InvoiceID,
		"status":             database.PurchaseStatusPending,
	}

	err = s.purchaseRepository.UpdateFields(ctx, purchaseId, updates)
	if err != nil {
		slog.Error("Error updating purchase", err)
		return "", 0, err
	}

	return invoice.BotInvoiceUrl, purchaseId, nil
}

func (s PaymentService) createYookasaInvoice(ctx context.Context, amount float64, months int, extraHwid int, customer *database.Customer, meta *PromoMeta) (url string, purchaseId int64, err error) {
	pur := &database.Purchase{
		InvoiceType: database.InvoiceTypeYookasa,
		Status:      database.PurchaseStatusNew,
		Amount:      amount,
		Currency:    "RUB",
		CustomerID:  customer.ID,
		Month:       months,
		ExtraHwid:   extraHwid,
	}
	if meta != nil {
		pur.PromoCodeID = meta.PromoCodeID
		pur.DiscountPercentApplied = meta.DiscountPercentApplied
	}
	purchaseId, err = s.purchaseRepository.Create(ctx, pur)
	if err != nil {
		slog.Error("Error creating purchase", err)
		return "", 0, err
	}

	invoice, err := s.yookasaClient.CreateInvoice(ctx, int(amount), months, extraHwid, customer.ID, purchaseId)
	if err != nil {
		slog.Error("Error creating invoice", err)
		return "", 0, err
	}

	updates := map[string]interface{}{
		"yookasa_url": invoice.Confirmation.ConfirmationURL,
		"yookasa_id":  invoice.ID,
		"status":      database.PurchaseStatusPending,
	}

	err = s.purchaseRepository.UpdateFields(ctx, purchaseId, updates)
	if err != nil {
		slog.Error("Error updating purchase", err)
		return "", 0, err
	}

	return invoice.Confirmation.ConfirmationURL, purchaseId, nil
}

func (s PaymentService) createTelegramInvoice(ctx context.Context, amount float64, months int, extraHwid int, customer *database.Customer, meta *PromoMeta) (url string, purchaseId int64, err error) {
	pur := &database.Purchase{
		InvoiceType: database.InvoiceTypeTelegram,
		Status:      database.PurchaseStatusNew,
		Amount:      amount,
		Currency:    "STARS",
		CustomerID:  customer.ID,
		Month:       months,
		ExtraHwid:   extraHwid,
	}
	if meta != nil {
		pur.PromoCodeID = meta.PromoCodeID
		pur.DiscountPercentApplied = meta.DiscountPercentApplied
	}
	purchaseId, err = s.purchaseRepository.Create(ctx, pur)
	if err != nil {
		slog.Error("Error creating purchase", err)
		return "", 0, nil
	}

	username, _ := ctx.Value(remnawave.CtxKeyUsername).(string)
	invoiceUrl, err := s.telegramBot.CreateInvoiceLink(ctx, &bot.CreateInvoiceLinkParams{
		Title:    s.translation.GetText(customer.Language, "invoice_title"),
		Currency: "XTR",
		Prices: []models.LabeledPrice{
			{
				Label:  s.translation.GetText(customer.Language, "invoice_label"),
				Amount: int(amount),
			},
		},
		Description: s.translation.GetText(customer.Language, "invoice_description"),
		Payload:     fmt.Sprintf("%d&%s", purchaseId, username),
	})

	updates := map[string]interface{}{
		"status": database.PurchaseStatusPending,
	}

	err = s.purchaseRepository.UpdateFields(ctx, purchaseId, updates)
	if err != nil {
		slog.Error("Error updating purchase", err)
		return "", 0, err
	}

	return invoiceUrl, purchaseId, nil
}

func (s PaymentService) ActivateTrial(ctx context.Context, telegramId int64) (string, error) {
	if config.TrialDays() == 0 {
		return "", nil
	}
	customer, err := s.customerRepository.FindByTelegramId(ctx, telegramId)
	if err != nil {
		slog.Error("Error finding customer", err)
		return "", err
	}
	if customer == nil {
		return "", fmt.Errorf("customer %d not found", telegramId)
	}
	user, err := s.remnawaveClient.CreateOrUpdateUser(ctx, customer.ID, telegramId, config.TrialTrafficLimit(), config.TrialDays(), true)
	if err != nil {
		slog.Error("Error creating user", err)
		return "", err
	}

	customerFilesToUpdate := map[string]interface{}{
		"subscription_link": user.SubscriptionUrl,
		"expire_at":         user.ExpireAt,
	}

	err = s.customerRepository.UpdateFields(ctx, customer.ID, customerFilesToUpdate)
	if err != nil {
		return "", err
	}

	return user.SubscriptionUrl, nil

}

func (s PaymentService) CancelYookassaPayment(purchaseId int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	purchase, err := s.purchaseRepository.FindById(ctx, purchaseId)
	if err != nil {
		return err
	}
	if purchase == nil {
		return fmt.Errorf("purchase with crypto invoice id %s not found", utils.MaskHalfInt64(purchaseId))
	}

	purchaseFieldsToUpdate := map[string]interface{}{
		"status": database.PurchaseStatusCancel,
	}

	err = s.purchaseRepository.UpdateFields(ctx, purchaseId, purchaseFieldsToUpdate)
	if err != nil {
		return err
	}

	return nil
}

func (s PaymentService) createTributeInvoice(ctx context.Context, amount float64, months int, extraHwid int, customer *database.Customer, _ *PromoMeta) (url string, purchaseId int64, err error) {
	purchaseId, err = s.purchaseRepository.Create(ctx, &database.Purchase{
		InvoiceType: database.InvoiceTypeTribute,
		Status:      database.PurchaseStatusPending,
		Amount:      amount,
		Currency:    "RUB",
		CustomerID:  customer.ID,
		Month:       months,
		ExtraHwid:   extraHwid,
	})
	if err != nil {
		slog.Error("Error creating purchase", err)
		return "", 0, err
	}

	return "", purchaseId, nil
}

// notifyAdminMoynalogFailure отправляет админу уведомление о неуспешной отправке чека в МойНалог
func notifyAdminMoynalogFailure(ctx context.Context, b *bot.Bot, adminID int64, purchase *database.Purchase, sendErr error, description string) {
	if b == nil || adminID == 0 || purchase == nil {
		return
	}

	msg := fmt.Sprintf(
		"Не удалось создать чек в Мой Налог.\nПокупка ID: %d\nСумма: %.2f\nОписание: %s\nТип счета: %s\nОшибка: %v",
		purchase.ID,
		purchase.Amount,
		description,
		purchase.InvoiceType,
		sendErr,
	)

	if _, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: adminID,
		Text:   msg,
	}); err != nil {
		slog.Error("Failed to notify admin about moynalog receipt failure", "error", err, "purchase_id", utils.MaskHalfInt64(purchase.ID))
	}
}
