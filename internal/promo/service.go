package promo

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"
	"unicode"

	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
	"remnawave-tg-shop-bot/internal/remnawave"
	"remnawave-tg-shop-bot/utils"
)

// Service applies promo codes and manages pending discounts.
type Service struct {
	PromoRepo      *database.PromoRepository
	CustomerRepo   *database.CustomerRepository
	PurchaseRepo   *database.PurchaseRepository
	Remnawave      *remnawave.Client
}

func NewService(promo *database.PromoRepository, customers *database.CustomerRepository, purchases *database.PurchaseRepository, rw *remnawave.Client) *Service {
	return &Service{
		PromoRepo:    promo,
		CustomerRepo: customers,
		PurchaseRepo: purchases,
		Remnawave:    rw,
	}
}

// NormalizeCode uppercases and trims (DB stores uppercase).
func NormalizeCode(s string) string {
	return strings.TrimSpace(strings.ToUpper(s))
}

// ValidCodePattern: Latin letters and digits only (admin wizard).
func ValidCodePattern(s string) bool {
	s = NormalizeCode(s)
	if s == "" || len(s) > 64 {
		return false
	}
	for _, r := range s {
		if unicode.IsLetter(r) {
			if r > unicode.MaxASCII || (r < 'A' || r > 'Z') {
				return false
			}
			continue
		}
		if unicode.IsDigit(r) {
			continue
		}
		return false
	}
	return true
}

// Activate validates and applies a promo code for the customer. Customer must be non-nil.
// One-time discount: pending row is cleared after the next successful subscription payment (see payment flow).
func (s *Service) Activate(ctx context.Context, telegramID int64, username string, customer *database.Customer, rawCode string) (*ActivateResult, error) {
	if customer == nil {
		return nil, database.ValidationErrorf("no customer")
	}
	code := NormalizeCode(rawCode)
	if code == "" {
		return nil, database.ValidationErrorf("empty code")
	}

	tx, err := s.PromoRepo.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	p, err := s.PromoRepo.FindByCodeForUpdate(ctx, tx, code)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, database.ValidationErrorf("not found")
	}

	if err := s.validatePromoRow(ctx, p, customer); err != nil {
		return nil, err
	}

	if err := s.PromoRepo.InsertRedemption(ctx, tx, p.ID, customer.ID); err != nil {
		return nil, err
	}
	if err := s.PromoRepo.IncrementUses(ctx, tx, p.ID); err != nil {
		return nil, err
	}

	if p.Type == database.PromoTypeDiscount {
		var exp *time.Time
		untilFirst := false
		if p.DiscountTTLHours != nil && *p.DiscountTTLHours == 0 {
			untilFirst = true
		} else if p.DiscountTTLHours != nil && *p.DiscountTTLHours > 0 {
			t := time.Now().UTC().Add(time.Duration(*p.DiscountTTLHours) * time.Hour)
			exp = &t
		}
		if err := s.PromoRepo.UpsertPendingDiscount(ctx, tx, customer.ID, p.ID, *p.DiscountPercent, exp, untilFirst); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	if p.Type == database.PromoTypeDiscount {
		slog.Info("promo activated", "promo_id", p.ID, "type", p.Type, "customer_id", utils.MaskHalfInt64(customer.ID))
		return &ActivateResult{Type: database.PromoTypeDiscount, DiscountPercent: *p.DiscountPercent}, nil
	}

	ctxUser := context.WithValue(ctx, remnawave.CtxKeyUsername, username)
	res, err := s.applyEffect(ctxUser, telegramID, customer, p)
	if err != nil {
		s.compensate(ctx, p.ID, customer.ID)
		slog.Error("promo effect failed, compensated", "err", err, "promo_id", p.ID, "customer_id", utils.MaskHalfInt64(customer.ID))
		return nil, err
	}

	slog.Info("promo activated", "promo_id", p.ID, "type", p.Type, "customer_id", utils.MaskHalfInt64(customer.ID))
	return res, nil
}

func (s *Service) validatePromoRow(ctx context.Context, p *database.PromoCode, customer *database.Customer) error {
	if !p.Active {
		return database.ValidationErrorf("inactive")
	}
	if p.ValidUntil != nil && time.Now().After(*p.ValidUntil) {
		return database.ValidationErrorf("expired")
	}
	max := p.MaxUses
	unlimited := max == nil || *max == 0
	if !unlimited && p.UsesCount >= *max {
		return database.ValidationErrorf("max uses")
	}
	has, err := s.PromoRepo.HasRedemption(ctx, p.ID, customer.ID)
	if err != nil {
		return err
	}
	if has {
		return database.ValidationErrorf("already redeemed")
	}
	if p.RequireCustomerInDB {
		// Customer row already exists if we're here; reserved for future stricter checks.
	}
	if p.FirstPurchaseOnly {
		n, err := s.PurchaseRepo.CountPaidSubscriptionsByCustomer(ctx, customer.ID)
		if err != nil {
			return err
		}
		if n > 0 {
			return database.ValidationErrorf("first purchase only")
		}
	}

	switch p.Type {
	case database.PromoTypeSubscriptionDays:
		if p.SubscriptionDays == nil || *p.SubscriptionDays <= 0 {
			return database.ValidationErrorf("bad subscription_days")
		}
	case database.PromoTypeTrial:
		if p.TrialDays == nil || *p.TrialDays <= 0 {
			return database.ValidationErrorf("bad trial_days")
		}
	case database.PromoTypeExtraHwid:
		if p.ExtraHwidDelta == nil || *p.ExtraHwidDelta <= 0 {
			return database.ValidationErrorf("bad extra_hwid")
		}
		if customer.ExpireAt == nil || !customer.ExpireAt.After(time.Now()) {
			return database.ValidationErrorf("extra_hwid needs active sub")
		}
	case database.PromoTypeDiscount:
		if p.DiscountPercent == nil || *p.DiscountPercent < 1 || *p.DiscountPercent > 100 {
			return database.ValidationErrorf("bad discount percent")
		}
		if p.DiscountTTLHours == nil {
			return database.ValidationErrorf("bad discount ttl")
		}
		pd, err := s.PromoRepo.GetPendingDiscountByCustomerID(ctx, customer.ID)
		if err != nil {
			return err
		}
		if pd != nil {
			return database.ValidationErrorf("pending discount")
		}
	default:
		return database.ValidationErrorf("unknown type")
	}
	return nil
}

func (s *Service) compensate(ctx context.Context, promoID, customerID int64) {
	tx, err := s.PromoRepo.Pool().Begin(ctx)
	if err != nil {
		slog.Error("promo compensate begin failed", "error", err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := s.PromoRepo.DeleteRedemption(ctx, tx, promoID, customerID); err != nil {
		slog.Error("promo compensate delete redemption", "error", err)
		return
	}
	if err := s.PromoRepo.DecrementUses(ctx, tx, promoID); err != nil {
		slog.Error("promo compensate decrement", "error", err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		slog.Error("promo compensate commit", "error", err)
	}
}

func (s *Service) applyEffect(ctx context.Context, telegramID int64, customer *database.Customer, p *database.PromoCode) (*ActivateResult, error) {
	switch p.Type {
	case database.PromoTypeDiscount:
		return nil, nil
	case database.PromoTypeSubscriptionDays:
		if err := s.applySubscriptionDays(ctx, telegramID, customer, *p.SubscriptionDays); err != nil {
			return nil, err
		}
		return &ActivateResult{Type: database.PromoTypeSubscriptionDays, SubscriptionDays: *p.SubscriptionDays}, nil
	case database.PromoTypeTrial:
		skipped, err := s.applyTrial(ctx, telegramID, customer, *p.TrialDays, p.AllowTrialWithoutPayment)
		if err != nil {
			return nil, err
		}
		return &ActivateResult{Type: database.PromoTypeTrial, TrialDays: *p.TrialDays, TrialSkippedActiveSub: skipped}, nil
	case database.PromoTypeExtraHwid:
		if err := s.applyExtraHwid(ctx, telegramID, customer, *p.ExtraHwidDelta); err != nil {
			return nil, err
		}
		return &ActivateResult{Type: database.PromoTypeExtraHwid, ExtraHwidDelta: *p.ExtraHwidDelta}, nil
	default:
		return nil, fmt.Errorf("unknown promo type %s", p.Type)
	}
}

func (s *Service) applySubscriptionDays(ctx context.Context, telegramID int64, customer *database.Customer, days int) error {
	hasActive := customer.ExpireAt != nil && customer.ExpireAt.After(time.Now())
	var user *remnawave.User
	var err error
	if hasActive {
		user, err = s.Remnawave.ExtendSubscriptionByDaysPreserveSquads(ctx, customer.ID, telegramID, days)
	} else {
		user, err = s.Remnawave.CreateOrUpdateUserFromNow(ctx, customer.ID, telegramID, config.TrafficLimit(), days, false)
	}
	if err != nil {
		return err
	}
	return s.CustomerRepo.UpdateFields(ctx, customer.ID, map[string]interface{}{
		"subscription_link": user.SubscriptionUrl,
		"expire_at":         user.ExpireAt,
	})
}

// applyTrial returns skipped=true if user already has an active subscription (no Remnawave change; promo still redeemed).
func (s *Service) applyTrial(ctx context.Context, telegramID int64, customer *database.Customer, days int, allowTrialWithoutPayment bool) (skipped bool, err error) {
	hasActiveSub := customer.ExpireAt != nil && customer.ExpireAt.After(time.Now())
	if hasActiveSub {
		return true, nil
	}
	if !allowTrialWithoutPayment {
		if customer.SubscriptionLink != nil {
			return false, database.ValidationErrorf("trial not allowed")
		}
	}
	user, err := s.Remnawave.CreateOrUpdateUser(ctx, customer.ID, telegramID, config.TrialTrafficLimit(), days, true)
	if err != nil {
		return false, err
	}
	err = s.CustomerRepo.UpdateFields(ctx, customer.ID, map[string]interface{}{
		"subscription_link": user.SubscriptionUrl,
		"expire_at":         user.ExpireAt,
	})
	if err != nil {
		return false, err
	}
	return false, nil
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

func (s *Service) applyExtraHwid(ctx context.Context, telegramID int64, customer *database.Customer, delta int) error {
	userInfo, err := s.Remnawave.GetUserTrafficInfo(ctx, telegramID)
	if err != nil {
		return err
	}
	current := resolveDeviceLimit(userInfo)
	newLimit := current + delta
	maxLimit := config.HwidMaxDevices()
	if maxLimit > 0 && newLimit > maxLimit {
		newLimit = maxLimit
	}
	updated, err := s.Remnawave.UpdateUserDeviceLimit(ctx, telegramID, newLimit)
	if err != nil {
		return err
	}
	newExtra := customer.ExtraHwid + delta
	if customer.ExpireAt == nil {
		return database.ValidationErrorf("no expire for extra")
	}
	updates := map[string]interface{}{
		"extra_hwid":            newExtra,
		"extra_hwid_expires_at": customer.ExpireAt,
	}
	if updated != nil {
		updates["subscription_link"] = updated.SubscriptionUrl
		updates["expire_at"] = updated.ExpireAt
	}
	return s.CustomerRepo.UpdateFields(ctx, customer.ID, updates)
}

// getActivePendingDiscount loads pending discount and deletes the row if time-limited discount has expired.
func (s *Service) getActivePendingDiscount(ctx context.Context, customerID int64) (*database.PendingDiscount, error) {
	if s == nil {
		return nil, nil
	}
	d, err := s.PromoRepo.GetPendingDiscountByCustomerID(ctx, customerID)
	if err != nil || d == nil {
		return nil, err
	}
	if !d.UntilFirstPurchase && d.ExpiresAt != nil && time.Now().After(*d.ExpiresAt) {
		if delErr := s.PromoRepo.DeletePendingDiscount(ctx, customerID); delErr != nil {
			slog.Error("clear expired discount", "error", delErr)
		}
		return nil, nil
	}
	return d, nil
}

// PendingDiscountForPayment returns percent 0-100 if a discount applies; clears expired pending discounts.
func (s *Service) PendingDiscountForPayment(ctx context.Context, customerID int64) (percent int, promoCodeID int64, err error) {
	d, err := s.getActivePendingDiscount(ctx, customerID)
	if err != nil || d == nil {
		return 0, 0, err
	}
	return d.Percent, d.PromoCodeID, nil
}

// PendingDiscountForConnectUI returns pending discount for the My VPN screen; expired rows are cleared.
func (s *Service) PendingDiscountForConnectUI(ctx context.Context, customerID int64) (percent int, untilFirst bool, expiresAt *time.Time, ok bool, err error) {
	d, err := s.getActivePendingDiscount(ctx, customerID)
	if err != nil || d == nil {
		return 0, false, nil, false, err
	}
	return d.Percent, d.UntilFirstPurchase, d.ExpiresAt, true, nil
}

// ClearPendingDiscountAfterSuccessfulSubscriptionPayment removes discount after a paid subscription invoice completes.
func (s *Service) ClearPendingDiscountAfterSuccessfulSubscriptionPayment(ctx context.Context, customerID int64) error {
	return s.PromoRepo.DeletePendingDiscount(ctx, customerID)
}

// IsPromoValidationErr is true for failed validation / effect (user sees neutral message).
func IsPromoValidationErr(err error) bool {
	return err != nil && errors.Is(err, database.ErrPromoValidation)
}
