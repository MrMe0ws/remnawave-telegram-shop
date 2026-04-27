package service

import (
	"context"
	"errors"
	"fmt"

	"remnawave-tg-shop-bot/internal/cabinet/repository"
	"remnawave-tg-shop-bot/internal/config"
	"remnawave-tg-shop-bot/internal/database"
)

// LoyaltyTierDTO — публичное описание уровня для UI кабинета.
type LoyaltyTierDTO struct {
	SortOrder       int     `json:"sort_order"`
	XpMin           int64   `json:"xp_min"`
	DiscountPercent int     `json:"discount_percent"`
	DisplayName     *string `json:"display_name,omitempty"`
}

// LoyaltyDashboardResponse — GET /cabinet/api/me/loyalty.
type LoyaltyDashboardResponse struct {
	Enabled            bool            `json:"enabled"`
	XP                 int64           `json:"xp"`
	Current            *LoyaltyTierDTO `json:"current,omitempty"`
	Next               *LoyaltyTierDTO `json:"next,omitempty"`
	ProgressPercent    int             `json:"progress_percent"`
	XpInSegment        int64           `json:"xp_in_segment"`
	XpSegmentSpan      int64           `json:"xp_segment_span"`
	XpUntilNext        int64           `json:"xp_until_next"`
	FirstDiscountXpMin *int64          `json:"first_discount_xp_min,omitempty"`
}

func tierToDTO(t database.LoyaltyTier) *LoyaltyTierDTO {
	if t.ID == 0 {
		return nil
	}
	return &LoyaltyTierDTO{
		SortOrder:       t.SortOrder,
		XpMin:           t.XpMin,
		DiscountPercent: t.DiscountPercent,
		DisplayName:     t.DisplayName,
	}
}

// LoyaltyDashboard возвращает прогресс лояльности для экрана кабинета (как в боте).
func (s *Subscription) LoyaltyDashboard(ctx context.Context, accountID int64) (*LoyaltyDashboardResponse, error) {
	if accountID <= 0 {
		return nil, fmt.Errorf("loyalty: invalid account_id")
	}
	out := &LoyaltyDashboardResponse{Enabled: config.LoyaltyEnabled()}

	loadXP := func() error {
		link, err := s.links.FindByAccountID(ctx, accountID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return fmt.Errorf("loyalty: find link: %w", err)
		}
		if errors.Is(err, repository.ErrNotFound) {
			if s.bootstrap == nil {
				return nil
			}
			link, err = s.bootstrap.EnsureForAccount(ctx, accountID, "")
			if err != nil || link == nil {
				return nil
			}
		}
		customer, err := s.customers.FindById(ctx, link.CustomerID)
		if err != nil {
			return err
		}
		if customer != nil {
			out.XP = customer.LoyaltyXP
		}
		return nil
	}

	if !out.Enabled || s.loyalty == nil {
		if err := loadXP(); err != nil {
			return nil, err
		}
		return out, nil
	}

	if err := loadXP(); err != nil {
		return nil, err
	}

	xp := out.XP
	prog, err := s.loyalty.ProgressForXP(ctx, xp)
	if err != nil {
		return nil, fmt.Errorf("loyalty: progress: %w", err)
	}

	if prog.CurrentTier.ID != 0 {
		out.Current = tierToDTO(prog.CurrentTier)
	} else {
		out.Current = &LoyaltyTierDTO{SortOrder: 0, XpMin: 0, DiscountPercent: 0, DisplayName: nil}
	}

	if prog.NextTier != nil {
		out.Next = tierToDTO(*prog.NextTier)
	}

	var curMin int64
	if prog.CurrentTier.ID != 0 {
		curMin = prog.CurrentTier.XpMin
	}

	if prog.NextTier != nil {
		nextMin := prog.NextTier.XpMin
		span := nextMin - curMin
		out.XpSegmentSpan = span
		if span > 0 {
			inSeg := xp - curMin
			if inSeg < 0 {
				inSeg = 0
			}
			out.XpInSegment = inSeg
			pct := int(inSeg * 100 / span)
			if pct > 100 {
				pct = 100
			}
			out.ProgressPercent = pct
		} else {
			out.ProgressPercent = 100
		}
		until := nextMin - xp
		if until < 0 {
			until = 0
		}
		out.XpUntilNext = until
	} else {
		out.ProgressPercent = 100
		out.XpSegmentSpan = 0
		out.XpInSegment = 0
		out.XpUntilNext = 0
	}

	if m, ok, err := s.loyalty.MinXpMinWithPositiveDiscount(ctx); err == nil && ok {
		out.FirstDiscountXpMin = &m
	}

	return out, nil
}
