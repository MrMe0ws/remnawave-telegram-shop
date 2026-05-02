package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"remnawave-tg-shop-bot/internal/cabinet/bootstrap"
	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/loyalty"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

// bytesPerGB используется, чтобы отдать traffic_gb в человеческом формате
// (как в Remnawave-админке), а не сырые байты. 1024^3 — двоичный GiB, именно
// так считает панель.
const bytesPerGB = 1024 * 1024 * 1024

// Subscription — /cabinet/api/me/subscription service.
//
// При каждом Get (если передан клиент Remnawave) подтягиваем expire_at /
// subscription_link из панели и пишем в customer, чтобы кабинет не «застревал»
// после удаления пользователя в панели или ручных правок. При ошибке API
// (сеть) — оставляем данные из БД; при «user not found» — очищаем подписку в БД.
type Subscription struct {
	customers *database.CustomerRepository
	tariffs   *database.TariffRepository
	loyalty   *database.LoyaltyTierRepository
	links     *repository.AccountCustomerLinkRepo
	bootstrap *bootstrap.CustomerBootstrap
	rw        *remnawave.Client
	purchases *database.PurchaseRepository
}

// NewSubscription — конструктор. Все репозитории обязательны, кроме loyalty,
// tariffs и purchases: если nil, ответ просто не содержит соответствующих полей.
// rw может быть nil (локальный dev без панели) — тогда синхронизация пропускается.
func NewSubscription(
	customers *database.CustomerRepository,
	tariffs *database.TariffRepository,
	loyalty *database.LoyaltyTierRepository,
	links *repository.AccountCustomerLinkRepo,
	boot *bootstrap.CustomerBootstrap,
	rw *remnawave.Client,
	purchases *database.PurchaseRepository,
) *Subscription {
	return &Subscription{
		customers: customers,
		tariffs:   tariffs,
		loyalty:   loyalty,
		links:     links,
		bootstrap: boot,
		rw:        rw,
		purchases: purchases,
	}
}

// SubscriptionTariff — выжимка из tariff, безопасная к отдаче пользователю
// (без админских полей типа remnawave_tag / squad_uuids / tier_level).
//
// traffic_gb = null интерпретируется клиентом как «безлимит»: такова
// семантика traffic_limit_bytes=0 и в Remnawave-панели.
type SubscriptionTariff struct {
	ID          *int64  `json:"id,omitempty"`
	Slug        string  `json:"slug"`
	Name        *string `json:"name,omitempty"`
	TrafficGB   *int    `json:"traffic_gb,omitempty"`
	DeviceLimit int     `json:"device_limit"`
}

// SubscriptionResponse — корневой объект `GET /cabinet/api/me/subscription`.
//
// Все поля, кроме loyalty_xp, опциональны — у нового web-аккаунта, ещё не
// совершившего оплату, подписка отсутствует, и мы отдаём честный null.
type SubscriptionResponse struct {
	ExpireAt                 *time.Time          `json:"expire_at,omitempty"`
	SubscriptionLink         *string             `json:"subscription_link,omitempty"`
	Tariff                   *SubscriptionTariff `json:"tariff,omitempty"`
	SubscriptionPeriodMonths *int                `json:"subscription_period_months,omitempty"`
	TrafficUsedGB            *float64            `json:"traffic_used_gb,omitempty"`
	TrafficLimitGB           *int                `json:"traffic_limit_gb,omitempty"`
	LoyaltyXP                int64               `json:"loyalty_xp"`
	LoyaltyTier              *string             `json:"loyalty_tier,omitempty"`
	// IsTrial — активная подписка без оплаченных invoice с month>0 (как «ещё не платил» в боте).
	// Исключение: если Remnawave уже выставил лимит трафика выше триального — не триал (админка,
	// ручная выдача, рассинхрон purchase после миграции current_tariff_id).
	IsTrial bool `json:"is_trial"`
}

type LoyaltyHistoryItem struct {
	PurchaseID    int64      `json:"purchase_id"`
	PaidAt        *time.Time `json:"paid_at,omitempty"`
	XPGained      int64      `json:"xp_gained"`
	Amount        float64    `json:"amount"`
	Currency      string     `json:"currency"`
	InvoiceType   string     `json:"invoice_type"`
	PurchaseKind  string     `json:"purchase_kind"`
	RunningXP     int64      `json:"running_xp"`
}

type LoyaltyHistoryResponse struct {
	Items []LoyaltyHistoryItem `json:"items"`
}

// Get собирает SubscriptionResponse для cabinet_account.id=accountID.
//
// Порядок:
//  1. Находим link на customer. Если нет — пробуем дошить через bootstrap.
//     При неудаче возвращаем пустой ответ (loyalty_xp=0) — это валидно
//     для web-only юзера, только что зарегистрировавшегося.
//  2. Читаем customer; при наличии Remnawave-клиента — синхронизируем подписку
//     с панелью (запись в БД), затем перечитываем customer.
//  3. Считаем tariff: tariffs-режим → customer.current_tariff_id,
//     classic-режим → синтезируем единственный виртуальный тариф.
//  4. Если есть loyalty_tier_repo — подтягиваем display_name текущего уровня.
func (s *Subscription) Get(ctx context.Context, accountID int64) (*SubscriptionResponse, error) {
	if accountID <= 0 {
		return nil, fmt.Errorf("subscription: invalid account_id %d", accountID)
	}

	link, err := s.links.FindByAccountID(ctx, accountID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("subscription: find link: %w", err)
	}
	if errors.Is(err, repository.ErrNotFound) {
		if s.bootstrap == nil {
			return &SubscriptionResponse{}, nil
		}
		link, err = s.bootstrap.EnsureForAccount(ctx, accountID, "")
		if err != nil {
			slog.Warn("subscription: bootstrap failed", "account_id", accountID, "error", err)
			return &SubscriptionResponse{}, nil
		}
	}

	customer, err := s.customers.FindById(ctx, link.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("subscription: load customer %d: %w", link.CustomerID, err)
	}
	if customer == nil {
		return &SubscriptionResponse{}, nil
	}

	if s.rw != nil {
		synced, syncErr := s.syncSubscriptionFromRemnawave(ctx, customer)
		if syncErr != nil {
			slog.Warn("subscription: remnawave sync failed", "customer_id", customer.ID, "error", syncErr)
		} else if synced != nil {
			customer = synced
		}
	}
	var rwUser *remnawave.User
	if s.rw != nil && !customer.IsWebOnly && !utils.IsSyntheticTelegramID(customer.TelegramID) {
		u, err := s.rw.GetUserTrafficInfo(ctx, customer.TelegramID)
		if err != nil && !errors.Is(err, remnawave.ErrUserNotFound) {
			slog.Warn("subscription: remnawave traffic fetch failed",
				"telegram_id", utils.MaskHalfInt64(customer.TelegramID), "error", err)
		} else if err == nil {
			rwUser = u
		}
	}

	resp := &SubscriptionResponse{
		ExpireAt:                 customer.ExpireAt,
		SubscriptionLink:         customer.SubscriptionLink,
		SubscriptionPeriodMonths: customer.SubscriptionPeriodMonths,
		LoyaltyXP:                customer.LoyaltyXP,
	}
	if rwUser != nil {
		used := rwUser.UserTraffic.UsedTrafficBytes / bytesPerGB
		if used < 0 {
			used = 0
		}
		resp.TrafficUsedGB = &used
		if v := trafficGBFromBytes(rwUser.TrafficLimitBytes); v != nil {
			resp.TrafficLimitGB = v
		}
	}

	if tariff := s.resolveTariff(ctx, customer); tariff != nil {
		resp.Tariff = tariff
	}

	if s.purchases != nil {
		n, err := s.purchases.CountPaidSubscriptionsByCustomer(ctx, customer.ID)
		if err != nil {
			slog.Warn("subscription: paid subscription count failed",
				"customer_id", customer.ID, "error", err)
		} else {
			now := time.Now().UTC()
			linkSet := customer.SubscriptionLink != nil && strings.TrimSpace(*customer.SubscriptionLink) != ""
			active := customer.ExpireAt != nil && customer.ExpireAt.After(now) && linkSet
			resp.IsTrial = active && n == 0
		}
	}
	// Не затирать панель признаком триала из-за пустого purchase (backfill current_tariff_id и т.п.):
	// — лимит в панели выше триального из env;
	// — лимит 0 байт в панели = безлимит, но у настоящего триала list-user иногда тоже 0 — тогда не трогаем is_trial,
	//   пока expire_at не «длиннее типичного триала» (ручная выдача на много месяцев / 2099).
	if resp.IsTrial && rwUser != nil {
		now := time.Now().UTC()
		trialCap := int64(config.TrialTrafficLimit())
		if rwUser.TrafficLimitBytes <= 0 {
			trialTail := int(config.TrialDays()) + 60
			if trialTail < 120 {
				trialTail = 120
			}
			if customer.ExpireAt != nil && customer.ExpireAt.After(now.AddDate(0, 0, trialTail)) {
				resp.IsTrial = false
			}
		} else if trialCap > 0 && rwUser.TrafficLimitBytes > trialCap {
			resp.IsTrial = false
		}
	}

	if s.loyalty != nil {
		if name := s.resolveLoyaltyTierName(ctx, customer.LoyaltyXP); name != nil {
			resp.LoyaltyTier = name
		}
	}

	// Лимит трафика в UI: основной источник — Remnawave (user.trafficLimitBytes).
	// 0 байт в панели = безлимит (см. trafficGBFromBytes): не подставлять лимит строки тарифа поверх этого.
	// Триал из бота при пустом/нулевом ответе лимита из панели — TRIAL_TRAFFIC_LIMIT из env (как раньше).
	if resp.IsTrial {
		if config.TrialTrafficLimit() > 0 {
			if lim := trafficGBFromBytes(int64(config.TrialTrafficLimit())); lim != nil {
				resp.TrafficLimitGB = lim
			}
		}
	} else if resp.Tariff != nil && resp.Tariff.TrafficGB != nil && *resp.Tariff.TrafficGB > 0 && resp.TrafficLimitGB == nil &&
		(rwUser == nil || rwUser.TrafficLimitBytes > 0) {
		v := *resp.Tariff.TrafficGB
		resp.TrafficLimitGB = &v
	}

	return resp, nil
}

func (s *Subscription) LoyaltyHistory(ctx context.Context, accountID int64, limit, offset int) (*LoyaltyHistoryResponse, error) {
	if accountID <= 0 {
		return nil, fmt.Errorf("subscription loyalty history: invalid account_id %d", accountID)
	}
	if s.purchases == nil {
		return &LoyaltyHistoryResponse{Items: []LoyaltyHistoryItem{}}, nil
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	link, err := s.links.FindByAccountID(ctx, accountID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, fmt.Errorf("subscription loyalty history: find link: %w", err)
	}
	if errors.Is(err, repository.ErrNotFound) {
		if s.bootstrap == nil {
			return &LoyaltyHistoryResponse{Items: []LoyaltyHistoryItem{}}, nil
		}
		link, err = s.bootstrap.EnsureForAccount(ctx, accountID, "")
		if err != nil {
			slog.Warn("subscription loyalty history: bootstrap failed", "account_id", accountID, "error", err)
			return &LoyaltyHistoryResponse{Items: []LoyaltyHistoryItem{}}, nil
		}
	}

	customer, err := s.customers.FindById(ctx, link.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("subscription loyalty history: load customer %d: %w", link.CustomerID, err)
	}
	if customer == nil {
		return &LoyaltyHistoryResponse{Items: []LoyaltyHistoryItem{}}, nil
	}

	paid, err := s.purchases.FindPaidByCustomer(ctx, customer.ID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("subscription loyalty history: list purchases: %w", err)
	}
	if len(paid) == 0 {
		return &LoyaltyHistoryResponse{Items: []LoyaltyHistoryItem{}}, nil
	}

	items := make([]LoyaltyHistoryItem, 0, len(paid))
	runningXP := customer.LoyaltyXP
	for _, p := range paid {
		gain := loyalty.XPRubEquivalentForPurchase(&p)
		if gain <= 0 {
			continue
		}
		items = append(items, LoyaltyHistoryItem{
			PurchaseID:   p.ID,
			PaidAt:       p.PaidAt,
			XPGained:     gain,
			Amount:       p.Amount,
			Currency:     p.Currency,
			InvoiceType:  string(p.InvoiceType),
			PurchaseKind: string(p.PurchaseKind),
			RunningXP:    runningXP,
		})
		runningXP -= gain
		if runningXP < 0 {
			runningXP = 0
		}
	}
	return &LoyaltyHistoryResponse{Items: items}, nil
}

// resolveTariff возвращает тариф для отображения в кабинете:
//
//   - `SALES_MODE=tariffs` — читает tariff_repository по customer.CurrentTariffID.
//     При отсутствии id (пользователь ещё не покупал) возвращает nil.
//   - `SALES_MODE=classic` — отдаёт единственный виртуальный «classic»-тариф
//     из env, даже если подписка ещё не куплена: фронт показывает карточку
//     с параметрами «что вы купите», одинаковыми с ботом.
func (s *Subscription) resolveTariff(ctx context.Context, customer *database.Customer) *SubscriptionTariff {
	mode := config.SalesMode()
	if mode == SalesModeTariffs {
		if s.tariffs == nil || customer.CurrentTariffID == nil || *customer.CurrentTariffID <= 0 {
			return nil
		}
		t, err := s.tariffs.GetByID(ctx, *customer.CurrentTariffID)
		if err != nil {
			slog.Warn("subscription: load tariff failed",
				"tariff_id", *customer.CurrentTariffID, "error", err)
			return nil
		}
		if t == nil {
			return nil
		}
		id := t.ID
		return &SubscriptionTariff{
			ID:          &id,
			Slug:        t.Slug,
			Name:        t.Name,
			TrafficGB:   trafficGBFromBytes(t.TrafficLimitBytes),
			DeviceLimit: t.DeviceLimit,
		}
	}

	// classic: та же карточка, что в витрине /tariffs (buildClassicView).
	return &SubscriptionTariff{
		Slug:        SalesModeClassic,
		TrafficGB:   trafficGBFromBytes(int64(config.TrafficLimit())),
		DeviceLimit: config.PaidHwidLimit(),
	}
}

// resolveLoyaltyTierName возвращает display_name текущего уровня лояльности,
// если таблица loyalty_tier непуста и у уровня есть имя. Ошибки логируются
// и не роняют ответ — loyalty_xp всегда можно отдать сам по себе.
func (s *Subscription) resolveLoyaltyTierName(ctx context.Context, xp int64) *string {
	progress, err := s.loyalty.ProgressForXP(ctx, xp)
	if err != nil {
		slog.Warn("subscription: loyalty progress failed", "xp", xp, "error", err)
		return nil
	}
	// ID==0 означает, что ни один tier не достигнут (таблица пуста или xp < min).
	if progress.CurrentTier.ID == 0 {
		return nil
	}
	return progress.CurrentTier.DisplayName
}

// syncSubscriptionFromRemnawave подтягивает подписку из панели в строку customer.
// Возвращает (nil, nil) если обновление не требуется или панель временно недоступна;
// (c, err) при ошибке записи в БД; свежего customer при успешном изменении.
func (s *Subscription) syncSubscriptionFromRemnawave(ctx context.Context, c *database.Customer) (*database.Customer, error) {
	if s.rw == nil || c == nil {
		return nil, nil
	}
	// Web-only в панели часто без telegram_id (username cabinet_*); запрос по
	// synthetic id даёт «not found» и clearRWSubscriptionInDB стирал подписку в БД.
	// См. docs/cabinet/audit-telegram-id.md §1.6 и §1.3.
	if c.IsWebOnly || utils.IsSyntheticTelegramID(c.TelegramID) {
		return nil, nil
	}
	user, err := s.rw.GetUserTrafficInfo(ctx, c.TelegramID)
	if err != nil {
		if errors.Is(err, remnawave.ErrUserNotFound) {
			return s.clearRWSubscriptionInDB(ctx, c)
		}
		slog.Warn("subscription: remnawave get user failed",
			"telegram_id", utils.MaskHalfInt64(c.TelegramID), "error", err)
		return nil, nil
	}
	return s.applyRWSubscriptionToDB(ctx, c, user)
}

func (s *Subscription) clearRWSubscriptionInDB(ctx context.Context, c *database.Customer) (*database.Customer, error) {
	hasSub := c.ExpireAt != nil ||
		(c.SubscriptionLink != nil && strings.TrimSpace(*c.SubscriptionLink) != "") ||
		(c.CurrentTariffID != nil && *c.CurrentTariffID > 0)
	if !hasSub {
		return c, nil
	}
	updates := map[string]interface{}{
		"expire_at":                    nil,
		"subscription_link":            nil,
		"current_tariff_id":            nil,
		"subscription_period_start":    nil,
		"subscription_period_months":   nil,
	}
	if err := s.customers.UpdateFields(ctx, c.ID, updates); err != nil {
		return c, err
	}
	out, err := s.customers.FindById(ctx, c.ID)
	if err != nil {
		return c, err
	}
	if out == nil {
		return c, fmt.Errorf("subscription: customer %d missing after clear", c.ID)
	}
	return out, nil
}

func (s *Subscription) applyRWSubscriptionToDB(ctx context.Context, c *database.Customer, user *remnawave.User) (*database.Customer, error) {
	if user == nil {
		return nil, nil
	}
	var exp *time.Time
	if !user.ExpireAt.IsZero() {
		t := user.ExpireAt.UTC()
		exp = &t
	}
	var sub *string
	if v := strings.TrimSpace(user.SubscriptionUrl); v != "" {
		sub = &v
	}
	if subscriptionTimesAndLinksEqual(c.ExpireAt, exp, c.SubscriptionLink, sub) {
		return nil, nil
	}
	updates := map[string]interface{}{
		"expire_at":         exp,
		"subscription_link": sub,
	}
	if err := s.customers.UpdateFields(ctx, c.ID, updates); err != nil {
		return c, err
	}
	out, err := s.customers.FindById(ctx, c.ID)
	if err != nil {
		return c, err
	}
	if out == nil {
		return c, fmt.Errorf("subscription: customer %d missing after rw apply", c.ID)
	}
	return out, nil
}

func subscriptionTimesAndLinksEqual(
	dbExp *time.Time, rwExp *time.Time,
	dbLink *string, rwLink *string,
) bool {
	if !subscriptionTimePtrEqual(dbExp, rwExp) {
		return false
	}
	a := ""
	if dbLink != nil {
		a = strings.TrimSpace(*dbLink)
	}
	b := ""
	if rwLink != nil {
		b = strings.TrimSpace(*rwLink)
	}
	return a == b
}

func subscriptionTimePtrEqual(a, b *time.Time) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.UTC().Truncate(time.Second).Equal(b.UTC().Truncate(time.Second))
}

// trafficGBFromBytes конвертирует байты в GiB с округлением вниз. 0 → nil
// (безлимитный трафик в семантике Remnawave-панели).
func trafficGBFromBytes(bytesVal int64) *int {
	if bytesVal <= 0 {
		return nil
	}
	gb := int(bytesVal / bytesPerGB)
	return &gb
}
