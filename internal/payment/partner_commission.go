package payment

import (
	"context"
	"log/slog"
	"math"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/utils"
)

// partnerCommissionBase приводит сумму платежа к рублям.
//
// Все способы оплаты, кроме Telegram Stars, пишут в purchase сумму уже в рублях
// (крипта и Tribute тоже — см. createCryptoInvoice / createTributeInvoice), так
// что конвертировать нужно только Stars. Курс задаётся RUB_PER_STAR и на момент
// оплаты может быть не задан вовсе: тогда пересчитать не во что.
//
// В этом случае возвращается ok=false, и начисление НЕ делается. Альтернативы
// хуже: посчитать процент от количества звёзд — значит заплатить партнёру
// случайное число, а взять ноль — молча лишить его заработанного. Пропуск
// заметен в логах и в админке, и лечится заполнением одной переменной.
func partnerCommissionBase(p *database.Purchase) (float64, bool) {
	if p == nil {
		return 0, false
	}
	switch strings.ToUpper(strings.TrimSpace(p.Currency)) {
	case "XTR", "STARS":
		rate := config.RubPerStar()
		if rate <= 0 {
			return 0, false
		}
		return p.Amount * rate, true
	default:
		return p.Amount, true
	}
}

// partnerCountsPurchase — засчитывается ли покупка в партнёрскую комиссию.
//
// Доплата за дополнительные устройства по умолчанию не засчитывается: это
// техническая докупка действующего клиента, а не приведённая партнёром продажа.
// Продление и апгрейд тарифа засчитываются всегда — это и есть тот повторный
// доход, ради которого партнёрская программа существует.
func partnerCountsPurchase(p *database.Purchase) bool {
	if p == nil {
		return false
	}
	if p.PurchaseKind == database.PurchaseKindExtraHwid {
		return config.PartnerCountExtraHwid()
	}
	return true
}

// partnerPercentFor — процент партнёра для вида начисления. Индивидуальные
// условия перекрывают глобальные; NULL в базе означает «как у всех», поэтому
// именно указатель, а не ноль.
func partnerPercentFor(p *database.Partner, kind string) float64 {
	var individual *float64
	fallback := config.PartnerRenewalPercent()
	if kind == database.PartnerEarningKindFirst {
		fallback = config.PartnerFirstPercent()
		if p != nil {
			individual = p.FirstPercent
		}
	} else if p != nil {
		individual = p.RenewalPercent
	}
	if individual != nil {
		return clampCommissionPercent(*individual)
	}
	return clampCommissionPercent(fallback)
}

func clampCommissionPercent(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 100 {
		return 100
	}
	return v
}

// partnerCommissionAmount считает начисление и округляет до копеек.
// Округление именно здесь, а не в базе: партнёр видит эту сумму в истории и
// должен получить ровно её, без расхождения на копейку с остатком.
func partnerCommissionAmount(baseRub, percent float64) float64 {
	if baseRub <= 0 || percent <= 0 {
		return 0
	}
	return math.Round(baseRub*percent) / 100
}

// applyPartnerCommission начисляет партнёру процент с оплаты приведённого им
// клиента.
//
// Вызывается из finalizePurchase, то есть после того, как подписка уже продлена
// в панели и оплата зафиксирована. Ошибка здесь намеренно не возвращается
// наверх: откатить продление всё равно нельзя, а падение привело бы к повторной
// обработке платежа — то есть к повторному продлению. Потерянное начисление
// чинится ручной корректировкой в админке, задвоенная подписка — нет.
//
// Защита от двойного начисления структурная: уникальный индекс по purchase_id в
// partner_earning. Поэтому повторный вызов на одной покупке безопасен, а не
// «не должен случиться».
func (s PaymentService) applyPartnerCommission(ctx context.Context, purchase *database.Purchase, customer *database.Customer) {
	if s.partnerRepository == nil || purchase == nil || customer == nil {
		return
	}
	if !config.PartnerProgramEnabled() || !partnerCountsPurchase(purchase) {
		return
	}

	attribution, err := s.partnerRepository.AttributionByCustomer(ctx, customer.ID)
	if err != nil {
		slog.Error("partner commission: load attribution", "error", err, "customer_id", utils.MaskHalfInt64(customer.ID))
		return
	}
	if attribution == nil {
		return
	}

	partner, err := s.partnerRepository.FindByID(ctx, attribution.PartnerID)
	if err != nil {
		slog.Error("partner commission: load partner", "error", err, "partner_id", attribution.PartnerID)
		return
	}
	if !partner.IsActive() {
		return
	}

	// Партнёр не зарабатывает на собственных покупках. Закрепление на себя
	// отбивается ещё при переходе по ссылке, но покупка — тот момент, где
	// ошибка стоит денег, поэтому проверка дублируется.
	if partner.CustomerID == customer.ID {
		slog.Warn("partner commission: self purchase skipped",
			"partner_id", partner.ID, "customer_id", utils.MaskHalfInt64(customer.ID))
		return
	}

	baseRub, ok := partnerCommissionBase(purchase)
	if !ok {
		slog.Warn("partner commission skipped: RUB_PER_STAR is not set",
			"partner_id", partner.ID,
			"purchase_id", utils.MaskHalfInt64(purchase.ID),
			"currency", purchase.Currency,
			"amount", purchase.Amount)
		return
	}

	kind := database.PartnerEarningKindRenewal
	seen, err := s.partnerRepository.HasEarningForCustomer(ctx, partner.ID, customer.ID)
	if err != nil {
		slog.Error("partner commission: check previous earnings", "error", err, "partner_id", partner.ID)
		return
	}
	if !seen {
		kind = database.PartnerEarningKindFirst
	}

	percent := partnerPercentFor(partner, kind)
	amount := partnerCommissionAmount(baseRub, percent)
	if amount <= 0 {
		return
	}

	// Ноль дней холда — законная настройка «выводить сразу», а не выключенный
	// холд: тогда начисление создаётся уже доступным, без промежуточного шага.
	status := database.PartnerEarningHold
	var holdUntil *time.Time
	if days := config.PartnerHoldDays(); days > 0 {
		until := time.Now().UTC().AddDate(0, 0, days)
		holdUntil = &until
	} else {
		status = database.PartnerEarningAvailable
	}

	customerID := customer.ID
	purchaseID := purchase.ID
	inserted, err := s.partnerRepository.InsertEarning(ctx, database.PartnerEarning{
		PartnerID:     partner.ID,
		CustomerID:    &customerID,
		PurchaseID:    &purchaseID,
		LinkID:        attribution.LinkID,
		BaseAmount:    purchase.Amount,
		BaseCurrency:  purchase.Currency,
		BaseAmountRub: math.Round(baseRub*100) / 100,
		Percent:       percent,
		Amount:        amount,
		Kind:          kind,
		Status:        status,
		HoldUntil:     holdUntil,
	})
	if err != nil {
		slog.Error("partner commission: insert earning", "error", err,
			"partner_id", partner.ID, "purchase_id", utils.MaskHalfInt64(purchase.ID))
		return
	}
	if !inserted {
		// Покупка уже оплачена партнёру — повтор вебхука или поллера.
		return
	}

	slog.Info("partner commission accrued",
		"partner_id", partner.ID,
		"purchase_id", utils.MaskHalfInt64(purchase.ID),
		"kind", kind,
		"percent", percent,
		"amount", amount,
		"status", status)
}
