// Package payments — HTTP-независимый слой web-кабинета для создания счетов
// и чтения их статуса.
//
// Сервис переиспользует бизнес-логику существующего internal/payment:
//
//   - расчёт суммы (classic vs tariffs + upgrade/downgrade) идёт через
//     payment.ResolveTariffPurchase и config.Price — здесь мы _не дублируем_
//     никаких формул, только выбираем правильную ветку;
//   - создание purchase / получение payment_url идёт через обычный
//     PaymentService.CreatePurchase, но контекст доукомплектовывается
//     return_url / receipt_email / paid_btn_url — так в вебе не появляется
//     редиректа в Telegram после оплаты и чек летит на email пользователя;
//   - обработка самой оплаты (перевод purchase → paid, активация подписки)
//     уже работает фоновым worker'ом (checkYookasaInvoice /
//     checkCryptoPayInvoice) — он подхватит purchase, созданный из кабинета.
//
// cabinet_checkout играет роль «идемпотентной обёртки» над purchase:
// повторный POST с тем же Idempotency-Key не создаёт новый счёт.
package payments

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/bootstrap"
	cabmetrics "remnawave-tg-shop-bot/internal/cabinet/metrics"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/cryptopay"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/loyalty"
	"remnawave-tg-shop-bot/internal/payment"
	promosvc "remnawave-tg-shop-bot/internal/promo"
	"remnawave-tg-shop-bot/internal/yookasa"
)

// Sentinel-ошибки, на которые HTTP-слой маппит конкретные статусы.
var (
	// ErrInvalidInput — 400: period/provider/tariff_id не прошли валидацию.
	ErrInvalidInput = errors.New("payments: invalid input")
	// ErrProviderDisabled — 400: выбранный провайдер отключён в env.
	ErrProviderDisabled = errors.New("payments: provider disabled")
	// ErrCheckoutNotFound — 404 в GET /status.
	ErrCheckoutNotFound = errors.New("payments: checkout not found")
	// ErrForbidden — 403: чужой checkout.
	ErrForbidden = errors.New("payments: forbidden")
)

// supportedMonths — те же значения, что в витрине тарифов. Храним дубликат
// константы (а не импорт из service), чтобы не тянуть сюда HTTP-пакет.
var supportedMonths = map[int]bool{1: true, 3: true, 6: true, 12: true}

// Config задаёт внешние параметры, которые нельзя вывести из env внутри сервиса
// (в частности — CABINET_PUBLIC_URL живёт в cabinet/config, а этот пакет не
// должен тянуть весь cabinet/config, чтобы unit-тесты могли его инстанцировать).
type Config struct {
	// PublicURL без завершающего слэша. Пример: "https://cabinet.example.com".
	PublicURL string
	// MinIdempotencyKeyLen — минимальная длина Idempotency-Key (защита от
	// пустых/коротких ключей). Рекомендуется 16.
	MinIdempotencyKeyLen int
	// MaxIdempotencyKeyLen — максимальная длина (UNIQUE-колонка VARCHAR(64)).
	MaxIdempotencyKeyLen int
}

// DefaultConfig возвращает sane defaults. PublicURL заполняется caller'ом.
func DefaultConfig() Config {
	return Config{MinIdempotencyKeyLen: 16, MaxIdempotencyKeyLen: 64}
}

// CheckoutService — фасад над PaymentService для web-кабинета.
//
// Зависимости передаются через конструктор (чистая инъекция). Ни один из
// репозиториев не может быть nil — конструктор это проверяет.
type CheckoutService struct {
	cfg Config

	checkouts *repository.CheckoutRepo
	links     *repository.AccountCustomerLinkRepo
	customers *database.CustomerRepository
	purchases *database.PurchaseRepository
	tariffs   *database.TariffRepository
	accounts  *repository.AccountRepo
	bootstrap *bootstrap.CustomerBootstrap
	payments  *payment.PaymentService
	loyalty   *database.LoyaltyTierRepository
	promo     *promosvc.Service
}

// NewCheckoutService — конструктор.
func NewCheckoutService(
	cfg Config,
	checkouts *repository.CheckoutRepo,
	links *repository.AccountCustomerLinkRepo,
	customers *database.CustomerRepository,
	purchases *database.PurchaseRepository,
	tariffs *database.TariffRepository,
	accounts *repository.AccountRepo,
	boot *bootstrap.CustomerBootstrap,
	payments *payment.PaymentService,
	loyaltyRepo *database.LoyaltyTierRepository,
	promo *promosvc.Service,
) *CheckoutService {
	if cfg.MinIdempotencyKeyLen <= 0 {
		cfg.MinIdempotencyKeyLen = 16
	}
	if cfg.MaxIdempotencyKeyLen <= 0 || cfg.MaxIdempotencyKeyLen > 64 {
		cfg.MaxIdempotencyKeyLen = 64
	}
	return &CheckoutService{
		cfg:       cfg,
		checkouts: checkouts,
		links:     links,
		customers: customers,
		purchases: purchases,
		tariffs:   tariffs,
		accounts:  accounts,
		bootstrap: boot,
		payments:  payments,
		loyalty:   loyaltyRepo,
		promo:     promo,
	}
}

// CreateRequest — входной DTO HTTP-слоя.
//
// Extra-поля (hwid, promo) намеренно не реализуются в MVP Этапа 5, чтобы не
// разбалтывать расчёт цены. Добавим отдельным этапом, когда появится UI под них.
type CreateRequest struct {
	// Period — 1|3|6|12 месяцев.
	Period int
	// TariffID — обязательный в tariffs-режиме, игнорируется в classic.
	TariffID *int64
	// Provider — "yookassa" | "cryptopay".
	Provider string
	// IdempotencyKey — содержимое заголовка Idempotency-Key.
	IdempotencyKey string
}

// CreateResult — ответ для POST /cabinet/api/payments/checkout.
type CreateResult struct {
	CheckoutID int64  `json:"checkout_id"`
	Provider   string `json:"provider"`
	Status     string `json:"status"`
	PaymentURL string `json:"payment_url"`
	// Reused==true, если клиент повторно прислал тот же Idempotency-Key,
	// и мы вернули ранее выданный payment_url.
	Reused bool `json:"reused,omitempty"`
}

// StatusResult — ответ для GET /cabinet/api/payments/:id/status.
//
// SubscriptionLink и ExpireAt — ненулевые только в статусе "paid". UI поллит
// этот эндпоинт после редиректа с YooKassa/CryptoPay.
type StatusResult struct {
	CheckoutID       int64      `json:"checkout_id"`
	Status           string     `json:"status"`
	PaymentURL       string     `json:"payment_url,omitempty"`
	SubscriptionLink *string    `json:"subscription_link,omitempty"`
	ExpireAt         *time.Time `json:"expire_at,omitempty"`
}

// PreviewResult — ответ GET /payments/preview: сумма с учётом upgrade/downgrade (как у бота).
type PreviewResult struct {
	Amount           int    `json:"amount"`
	Currency         string `json:"currency"`
	AmountRub        int    `json:"amount_rub"`
	SalesMode        string `json:"sales_mode"`
	Scenario         string `json:"scenario"` // new | renew | upgrade | downgrade | classic_new | classic_renew
	PurchaseKind     string `json:"purchase_kind,omitempty"`
	IsEarlyDowngrade bool   `json:"is_early_downgrade,omitempty"`
	ListPriceRub     int    `json:"list_price_rub,omitempty"` // полная цена прайса за период (для сравнения в UI)
	// BaseAmountRub — сумма до скидок лояльности и pending-промокода (как в боте).
	BaseAmountRub      int `json:"base_amount_rub,omitempty"`
	LoyaltyDiscountPct int `json:"loyalty_discount_pct,omitempty"`
	PromoDiscountPct   int `json:"promo_discount_pct,omitempty"`
	TotalDiscountPct   int `json:"total_discount_pct,omitempty"`
}

// Create создаёт новый web-checkout или возвращает ранее выданный payment_url
// при повторе с тем же Idempotency-Key.
//
// Шаги:
//  1. Валидация входа.
//  2. Lookup по (account_id, idempotency_key). Если есть — возвращаем.
//  3. Bootstrap: гарантируем, что у аккаунта есть customer (EnsureForAccount).
//  4. Расчёт суммы (classic: config.Price / tariffs: ResolveTariffPurchase).
//  5. INSERT cabinet_checkout(status='new'). При конфликте по idempotency_key
//     — перечитываем и возвращаем.
//  6. Проставляем ctx-override'ы и вызываем PaymentService.CreatePurchase.
//  7. UPDATE cabinet_checkout SET purchase_id, return_url, status='pending'.
func (s *CheckoutService) Create(ctx context.Context, accountID int64, req CreateRequest) (*CreateResult, error) {
	if err := s.validateCreate(req); err != nil {
		return nil, err
	}
	provider := req.Provider
	invoiceType, err := mapProviderToInvoiceType(provider)
	if err != nil {
		return nil, err
	}
	if err := s.ensureProviderEnabled(provider); err != nil {
		return nil, err
	}

	if existing, err := s.checkouts.FindByIdempotencyKey(ctx, accountID, req.IdempotencyKey); err == nil {
		return s.reuseExisting(ctx, existing)
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("payments: find existing: %w", err)
	}

	// Гарантируем customer — создаём web-only, если link'а ещё нет.
	link, err := s.bootstrap.EnsureForAccount(ctx, accountID, "")
	if err != nil {
		return nil, fmt.Errorf("payments: bootstrap customer: %w", err)
	}
	customer, err := s.customers.FindById(ctx, link.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("payments: load customer: %w", err)
	}
	if customer == nil {
		return nil, fmt.Errorf("payments: customer %d not found after bootstrap", link.CustomerID)
	}

	acc, err := s.accounts.FindByID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("payments: load account: %w", err)
	}

	amount, tariffID, extras, err := s.resolveAmount(ctx, customer, invoiceType, req)
	if err != nil {
		return nil, err
	}

	amount, _, _, meta := s.applyCheckoutDiscounts(ctx, customer, invoiceType, amount)

	checkout, err := s.checkouts.Create(ctx, accountID, req.IdempotencyKey, provider)
	if err != nil {
		// Гонка: параллельный POST с тем же ключом уже успел вставить строку.
		if errors.Is(err, repository.ErrCheckoutConflict) {
			existing, ferr := s.checkouts.FindByIdempotencyKey(ctx, accountID, req.IdempotencyKey)
			if ferr != nil {
				return nil, fmt.Errorf("payments: read after conflict: %w", ferr)
			}
			return s.reuseExisting(ctx, existing)
		}
		return nil, fmt.Errorf("payments: create checkout: %w", err)
	}

	returnURL := s.buildReturnURL(checkout.ID)
	providerCtx := s.withProviderOverrides(ctx, provider, returnURL, acc)

	paymentURL, purchaseID, err := s.payments.CreatePurchase(
		providerCtx,
		float64(amount),
		req.Period,
		customer,
		invoiceType,
		meta,
		tariffID,
		extras,
	)
	if err != nil {
		// Checkout остался в 'new'. Можно попытаться отметить failed, но в MVP
		// оставляем как есть: клиент может прислать тот же ключ ещё раз, а
		// ErrCheckoutConflict → reuseExisting проверит purchase_id==nil и
		// вернёт ошибку «невалидный checkout, смените Idempotency-Key».
		return nil, fmt.Errorf("payments: create purchase: %w", err)
	}

	if err := s.checkouts.AttachPurchase(ctx, checkout.ID, purchaseID, returnURL); err != nil {
		// Purchase создан, но link не обновился — это легко лечится: GetStatus
		// увидит cabinet_checkout со status='new' и purchase_id=nil, и в этот
		// момент статус «провиснет». На MVP логируем и возвращаем успех.
		slog.Error("payments: attach purchase failed",
			"checkout_id", checkout.ID,
			"purchase_id", purchaseID,
			"error", err,
		)
	}

	return &CreateResult{
		CheckoutID: checkout.ID,
		Provider:   provider,
		Status:     repository.CheckoutStatusPending,
		PaymentURL: paymentURL,
	}, nil
}

// Preview считает сумму к оплате без создания checkout (та же логика, что Create → resolveAmount).
func (s *CheckoutService) Preview(ctx context.Context, accountID int64, period int, tariffID *int64, provider string) (*PreviewResult, error) {
	if !supportedMonths[period] {
		return nil, fmt.Errorf("%w: period must be one of 1/3/6/12", ErrInvalidInput)
	}
	if provider == "" {
		provider = repository.CheckoutProviderYookassa
	}
	invoiceType, err := mapProviderToInvoiceType(provider)
	if err != nil {
		return nil, err
	}
	if err := s.ensureProviderEnabled(provider); err != nil {
		return nil, err
	}
	link, err := s.bootstrap.EnsureForAccount(ctx, accountID, "")
	if err != nil {
		return nil, fmt.Errorf("payments: bootstrap customer: %w", err)
	}
	customer, err := s.customers.FindById(ctx, link.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("payments: load customer: %w", err)
	}
	if customer == nil {
		return nil, fmt.Errorf("payments: customer %d not found after bootstrap", link.CustomerID)
	}

	mode := config.SalesMode()
	out := &PreviewResult{SalesMode: mode}
	if invoiceType == database.InvoiceTypeTelegram {
		out.Currency = "STARS"
	} else {
		out.Currency = "RUB"
	}

	if mode == "tariffs" {
		if tariffID == nil || *tariffID <= 0 {
			return nil, fmt.Errorf("%w: tariff_id required in tariffs mode", ErrInvalidInput)
		}
		kind, amt, pk, early, rerr := payment.ResolveTariffPurchase(
			ctx, s.tariffs, customer, *tariffID, period, invoiceType == database.InvoiceTypeTelegram,
		)
		if rerr != nil {
			return nil, fmt.Errorf("payments: resolve tariff: %w", rerr)
		}
		out.Amount = amt
		out.AmountRub = amt
		out.PurchaseKind = string(pk)
		out.IsEarlyDowngrade = early
		out.Scenario = tariffCheckoutScenario(kind)
		if tp, err := s.tariffs.GetPrice(ctx, *tariffID, period); err == nil && tp != nil {
			out.ListPriceRub = tp.AmountRub
		}
		s.applyPreviewDiscounts(ctx, customer, invoiceType, out)
		return out, nil
	}

	price := config.Price(period)
	if invoiceType == database.InvoiceTypeTelegram {
		price = config.StarsPrice(period)
	}
	if price <= 0 {
		return nil, fmt.Errorf("payments: no price configured for %d months", period)
	}
	out.Amount = price
	out.AmountRub = price
	out.PurchaseKind = string(database.PurchaseKindSubscription)
	now := time.Now().UTC()
	if customer.ExpireAt != nil && customer.ExpireAt.After(now) {
		out.Scenario = "classic_renew"
	} else {
		out.Scenario = "classic_new"
	}
	s.applyPreviewDiscounts(ctx, customer, invoiceType, out)
	return out, nil
}

func tariffCheckoutScenario(kind payment.TariffCheckoutKind) string {
	switch kind {
	case payment.TariffCheckoutNew:
		return "new"
	case payment.TariffCheckoutRenewSame:
		return "renew"
	case payment.TariffCheckoutUpgrade:
		return "upgrade"
	case payment.TariffCheckoutDowngrade:
		return "downgrade"
	default:
		return "unknown"
	}
}

// GetStatus возвращает текущий статус checkout'а + ссылку на подписку, если
// оплата прошла. Попутно лениво синхронизирует cabinet_checkout.status с
// purchase.status — первый же поллинг после webhook'а бот приведёт в
// консистентное состояние.
func (s *CheckoutService) GetStatus(ctx context.Context, accountID, checkoutID int64) (*StatusResult, error) {
	checkout, err := s.checkouts.FindByID(ctx, checkoutID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrCheckoutNotFound
		}
		return nil, fmt.Errorf("payments: find checkout: %w", err)
	}
	if checkout.AccountID != accountID {
		return nil, ErrForbidden
	}

	result := &StatusResult{
		CheckoutID: checkout.ID,
		Status:     checkout.Status,
	}

	if checkout.PurchaseID == nil {
		// Счёт ещё не прикреплён к purchase — это возможно только в узкое
		// окно между INSERT checkout и AttachPurchase. UI должен перезапросить.
		return result, nil
	}

	purchase, err := s.purchases.FindById(ctx, *checkout.PurchaseID)
	if err != nil {
		return nil, fmt.Errorf("payments: load purchase: %w", err)
	}
	if purchase == nil {
		return nil, fmt.Errorf("payments: purchase %d missing", *checkout.PurchaseID)
	}

	desired := checkoutStatusForPurchase(purchase.Status)
	if desired != "" && desired != checkout.Status {
		if err := s.checkouts.UpdateStatus(ctx, checkout.ID, desired); err != nil {
			slog.Warn("payments: sync status failed", "checkout_id", checkout.ID, "error", err)
		} else if desired == repository.CheckoutStatusPaid {
			sec := time.Since(checkout.CreatedAt).Seconds()
			cabmetrics.RecordCheckoutPaidDuration(checkout.Provider, sec)
		}
		result.Status = desired
	}

	switch result.Status {
	case repository.CheckoutStatusPending:
		result.PaymentURL = paymentURLFromPurchase(purchase)
	case repository.CheckoutStatusPaid:
		link, err := s.links.FindByAccountID(ctx, accountID)
		if err == nil {
			if cust, err2 := s.customers.FindById(ctx, link.CustomerID); err2 == nil && cust != nil {
				result.SubscriptionLink = cust.SubscriptionLink
				result.ExpireAt = cust.ExpireAt
			}
		}
	}

	return result, nil
}

// ============================================================================
// Helpers: валидация, маппинги, URL-сборка
// ============================================================================

func (s *CheckoutService) validateCreate(req CreateRequest) error {
	if !supportedMonths[req.Period] {
		return fmt.Errorf("%w: period must be one of 1/3/6/12", ErrInvalidInput)
	}
	if _, err := mapProviderToInvoiceType(req.Provider); err != nil {
		return err
	}
	l := len(req.IdempotencyKey)
	if l < s.cfg.MinIdempotencyKeyLen || l > s.cfg.MaxIdempotencyKeyLen {
		return fmt.Errorf(
			"%w: idempotency key must be between %d and %d chars",
			ErrInvalidInput, s.cfg.MinIdempotencyKeyLen, s.cfg.MaxIdempotencyKeyLen,
		)
	}
	return nil
}

func (s *CheckoutService) ensureProviderEnabled(provider string) error {
	switch provider {
	case repository.CheckoutProviderYookassa:
		if !config.IsYookasaEnabled() {
			return fmt.Errorf("%w: yookassa disabled", ErrProviderDisabled)
		}
	case repository.CheckoutProviderCryptoPay:
		if !config.IsCryptoPayEnabled() {
			return fmt.Errorf("%w: cryptopay disabled", ErrProviderDisabled)
		}
	case repository.CheckoutProviderTelegram:
		if !config.IsTelegramStarsEnabled() {
			return fmt.Errorf("%w: telegram stars disabled", ErrProviderDisabled)
		}
	default:
		return fmt.Errorf("%w: unknown provider %q", ErrInvalidInput, provider)
	}
	return nil
}

// resolveAmount возвращает сумму (в рублях/stars), tariffID для purchase-строки
// и extras (kind/isEarlyDowngrade). В classic-режиме всегда tariffID==nil, extras==nil.
// applyCheckoutDiscounts — как handler.checkoutPromoMeta: лояльность + pending-промо, Tribute не используется в кабинете.
func (s *CheckoutService) applyCheckoutDiscounts(ctx context.Context, customer *database.Customer, invoiceType database.InvoiceType, base int) (final int, loyaltyPct, promoPct int, meta *payment.PromoMeta) {
	final = base
	if customer == nil || invoiceType == database.InvoiceTypeTribute {
		return final, 0, 0, nil
	}
	loyaltyPct = 0
	if config.LoyaltyEnabled() && s.loyalty != nil {
		var err error
		loyaltyPct, err = s.loyalty.DiscountPercentForXP(ctx, customer.LoyaltyXP)
		if err != nil {
			slog.Error("cabinet checkout loyalty discount", "error", err)
			loyaltyPct = 0
		}
	}
	promoPct = 0
	if s.promo != nil {
		pct, pid, err := s.promo.PendingDiscountForPayment(ctx, customer.ID)
		if err != nil {
			slog.Error("cabinet checkout pending promo", "error", err)
		} else if pct > 0 && pid != 0 {
			promoPct = pct
			pc := pct
			p := pid
			meta = &payment.PromoMeta{PromoCodeID: &p, DiscountPercentApplied: &pc}
		}
	}
	cap := config.LoyaltyMaxTotalDiscountPercent()
	final = loyalty.ApplyCombinedPercentDiscount(base, loyaltyPct, promoPct, cap)
	return final, loyaltyPct, promoPct, meta
}

func (s *CheckoutService) applyPreviewDiscounts(ctx context.Context, customer *database.Customer, invoiceType database.InvoiceType, out *PreviewResult) {
	base := out.AmountRub
	final, loyPct, proPct, _ := s.applyCheckoutDiscounts(ctx, customer, invoiceType, base)
	out.BaseAmountRub = base
	out.AmountRub = final
	out.Amount = final
	out.LoyaltyDiscountPct = loyPct
	out.PromoDiscountPct = proPct
	cap := config.LoyaltyMaxTotalDiscountPercent()
	out.TotalDiscountPct = loyalty.CombinedDiscountPercent(loyPct, proPct, cap)
}

func (s *CheckoutService) resolveAmount(
	ctx context.Context,
	customer *database.Customer,
	invoiceType database.InvoiceType,
	req CreateRequest,
) (amount int, tariffID *int64, extras *payment.TariffPurchaseExtras, err error) {
	invoiceStars := invoiceType == database.InvoiceTypeTelegram
	if config.SalesMode() == "tariffs" {
		if req.TariffID == nil || *req.TariffID <= 0 {
			return 0, nil, nil, fmt.Errorf("%w: tariff_id required in tariffs mode", ErrInvalidInput)
		}
		_, amt, kind, isEarly, rerr := payment.ResolveTariffPurchase(
			ctx, s.tariffs, customer, *req.TariffID, req.Period, invoiceStars,
		)
		if rerr != nil {
			return 0, nil, nil, fmt.Errorf("payments: resolve tariff: %w", rerr)
		}
		extras = &payment.TariffPurchaseExtras{Kind: kind, IsEarlyDowngrade: isEarly}
		tariffID = req.TariffID
		amount = amt
		return amount, tariffID, extras, nil
	}

	// classic
	if invoiceStars {
		price := config.StarsPrice(req.Period)
		if price <= 0 {
			return 0, nil, nil, fmt.Errorf("payments: no stars price configured for %d months", req.Period)
		}
		return price, nil, nil, nil
	}
	price := config.Price(req.Period)
	if price <= 0 {
		return 0, nil, nil, fmt.Errorf("payments: no price configured for %d months", req.Period)
	}
	return price, nil, nil, nil
}

// buildReturnURL собирает URL, на который провайдер вернёт пользователя после
// подтверждения оплаты. SPA на этом URL делает poll GET /payments/:id/status.
func (s *CheckoutService) buildReturnURL(checkoutID int64) string {
	if s.cfg.PublicURL == "" {
		return ""
	}
	return fmt.Sprintf("%s/cabinet/payment/status/%d", s.cfg.PublicURL, checkoutID)
}

// withProviderOverrides прокидывает return_url / receipt_email в контекст
// провайдера. Значения подхватываются yookasa.Client / PaymentService.
func (s *CheckoutService) withProviderOverrides(
	ctx context.Context,
	provider, returnURL string,
	acc *repository.Account,
) context.Context {
	switch provider {
	case repository.CheckoutProviderYookassa:
		if returnURL != "" {
			ctx = context.WithValue(ctx, yookasa.CtxKeyReturnURL, returnURL)
		}
		if email := receiptEmailForAccount(acc); email != "" {
			ctx = context.WithValue(ctx, yookasa.CtxKeyReceiptEmail, email)
		}
	case repository.CheckoutProviderCryptoPay:
		if returnURL != "" {
			ctx = context.WithValue(ctx, cryptopay.CtxKeyPaidBtnURL, returnURL)
		}
	}
	return ctx
}

// receiptEmailForAccount возвращает email пользователя, только если он
// подтверждён; в противном случае возвращает пустую строку — yookasa-клиент
// сам подставит config.YookasaEmail() как fallback.
func receiptEmailForAccount(acc *repository.Account) string {
	if acc == nil || acc.Email == nil {
		return ""
	}
	if !acc.EmailVerified() {
		return ""
	}
	return *acc.Email
}

// reuseExisting отдаёт клиенту ранее созданный checkout. Если purchase уже
// привязан и у него жив payment_url — отдаём его. Иначе 409-подобная ошибка
// (в MVP сигналим ErrInvalidInput — клиент должен выбрать новый Idempotency-Key).
func (s *CheckoutService) reuseExisting(ctx context.Context, checkout *repository.Checkout) (*CreateResult, error) {
	if checkout.PurchaseID == nil {
		return nil, fmt.Errorf("%w: checkout %d is in 'new' state, retry with a new Idempotency-Key", ErrInvalidInput, checkout.ID)
	}
	purchase, err := s.purchases.FindById(ctx, *checkout.PurchaseID)
	if err != nil {
		return nil, fmt.Errorf("payments: reuse load purchase: %w", err)
	}
	if purchase == nil {
		return nil, fmt.Errorf("payments: purchase %d missing", *checkout.PurchaseID)
	}
	url := paymentURLFromPurchase(purchase)
	if url == "" && purchase.Status != database.PurchaseStatusPaid {
		return nil, fmt.Errorf("%w: checkout %d has no payment_url", ErrInvalidInput, checkout.ID)
	}
	return &CreateResult{
		CheckoutID: checkout.ID,
		Provider:   checkout.Provider,
		Status:     checkout.Status,
		PaymentURL: url,
		Reused:     true,
	}, nil
}

// mapProviderToInvoiceType превращает значение из API в InvoiceType purchase-строки.
// Обратите внимание: в API и cabinet_checkout.provider — "yookassa" (официальное
// написание бренда), а в purchase.invoice_type — исторически "yookasa" (одна 's').
// Эта асимметрия закрепилась в миграциях бота и здесь мы её просто переводим.
func mapProviderToInvoiceType(provider string) (database.InvoiceType, error) {
	switch provider {
	case repository.CheckoutProviderYookassa:
		return database.InvoiceTypeYookasa, nil
	case repository.CheckoutProviderCryptoPay:
		return database.InvoiceTypeCrypto, nil
	case repository.CheckoutProviderTelegram:
		return database.InvoiceTypeTelegram, nil
	default:
		return "", fmt.Errorf("%w: unknown provider %q", ErrInvalidInput, provider)
	}
}

// checkoutStatusForPurchase — маппинг purchase.status → cabinet_checkout.status.
// Возвращает пустую строку для статусов, которые не мапятся (например 'new').
func checkoutStatusForPurchase(status database.PurchaseStatus) string {
	switch status {
	case database.PurchaseStatusPaid:
		return repository.CheckoutStatusPaid
	case database.PurchaseStatusPending, database.PurchaseStatusNew:
		return repository.CheckoutStatusPending
	case database.PurchaseStatusCancel:
		return repository.CheckoutStatusFailed
	default:
		return ""
	}
}

// paymentURLFromPurchase возвращает URL оплаты в зависимости от провайдера,
// читая поля purchase, которые пишет PaymentService.createYookasaInvoice /
// createCryptoInvoice.
func paymentURLFromPurchase(p *database.Purchase) string {
	if p == nil {
		return ""
	}
	switch p.InvoiceType {
	case database.InvoiceTypeYookasa:
		if p.YookasaURL != nil {
			return *p.YookasaURL
		}
	case database.InvoiceTypeCrypto:
		if p.CryptoInvoiceLink != nil {
			return *p.CryptoInvoiceLink
		}
	case database.InvoiceTypeTelegram:
		if p.CryptoInvoiceLink != nil {
			return *p.CryptoInvoiceLink
		}
	}
	return ""
}
