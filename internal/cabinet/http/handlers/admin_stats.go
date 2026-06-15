package handlers

import (
	"log/slog"
	"net/http"
	"time"

	"remnawave-tg-shop-bot/internal/database"
)

// AdminStatsHandler — эндпоинты GET /cabinet/api/admin/stats, /cabinet/api/admin/stats/fortune.
type AdminStatsHandler struct {
	stats *database.StatsRepository
}

// NewAdminStats — конструктор.
func NewAdminStats(stats *database.StatsRepository) *AdminStatsHandler {
	return &AdminStatsHandler{stats: stats}
}

type adminTopReferrerDTO struct {
	ReferrerID   int64 `json:"referrer_id"`
	PaidReferees int64 `json:"paid_referees"`
}

type adminTariffStatDTO struct {
	TariffID         int64   `json:"tariff_id"`
	DisplayName      string  `json:"display_name"`
	SalesToday       int64   `json:"sales_today"`
	SalesWeek        int64   `json:"sales_week"`
	SalesMonth       int64   `json:"sales_month"`
	SalesHalfYear    int64   `json:"sales_half_year"`
	SalesYear        int64   `json:"sales_year"`
	SubsRevenueMonth float64 `json:"subs_revenue_month"`
	RevenueToday     float64 `json:"revenue_today"`
	RevenueWeek      float64 `json:"revenue_week"`
	RevenueHalfYear  float64 `json:"revenue_half_year"`
	RevenueYear      float64 `json:"revenue_year"`
	RevenueAll       float64 `json:"revenue_all"`
	ActivePaidUsers  int64   `json:"active_paid_users"`
}

type adminStatsResp struct {
	CapturedAt          string             `json:"captured_at"`
	TotalCustomers      int64              `json:"total_customers"`
	ActiveSubscriptions int64              `json:"active_subscriptions"`
	NewToday            int64              `json:"new_today"`
	NewWeek             int64              `json:"new_week"`
	NewMonth            int64              `json:"new_month"`
	NewPrevMonth        int64              `json:"new_prev_month"`
	NewHalfYear         int64              `json:"new_half_year"`
	NewYear             int64              `json:"new_year"`
	TrialActive         int64              `json:"trial_active"`
	PaidActive          int64              `json:"paid_active"`
	Inactive            int64              `json:"inactive"`
	SalesSubToday       int64              `json:"sales_sub_today"`
	SalesSubWeek        int64              `json:"sales_sub_week"`
	SalesSubMonth       int64              `json:"sales_sub_month"`
	SalesSubPrevMonth   int64              `json:"sales_sub_prev_month"`
	SalesSubHalfYear    int64              `json:"sales_sub_half_year"`
	SalesSubYear        int64              `json:"sales_sub_year"`
	RevenueMonthRub     float64            `json:"revenue_month_rub"`
	RevenueTodayRub     float64            `json:"revenue_today_rub"`
	RevenueWeekRub      float64            `json:"revenue_week_rub"`
	RevenueHalfYearRub  float64            `json:"revenue_half_year_rub"`
	RevenueYearRub      float64            `json:"revenue_year_rub"`
	RevenueAllTimeRub   float64            `json:"revenue_all_time_rub"`
	RevenueSubsMonthRub float64            `json:"revenue_subs_month_rub"`
	TransactionsToday   int64              `json:"transactions_today"`
	TransactionsWeek    int64              `json:"transactions_week"`
	TransactionsMonth   int64              `json:"transactions_month"`
	TransactionsHalfYear int64             `json:"transactions_half_year"`
	TransactionsYear    int64              `json:"transactions_year"`
	UniquePayersDay     int64              `json:"unique_payers_day"`
	UniquePayersWeek    int64              `json:"unique_payers_week"`
	UniquePayersMonth   int64              `json:"unique_payers_month"`
	UniquePayersHalfYear int64             `json:"unique_payers_half_year"`
	UniquePayersYear    int64              `json:"unique_payers_year"`
	PaymentRubByInvoice map[string]float64 `json:"payment_rub_by_invoice"`
	DistinctReferrers   int64              `json:"distinct_referrers"`
	ActiveReferrers     int64              `json:"active_referrers"`
	RefBonusDaysAll     int64              `json:"ref_bonus_days_all"`
	RefBonusDaysToday   int64              `json:"ref_bonus_days_today"`
	RefBonusDaysWeek    int64              `json:"ref_bonus_days_week"`
	RefBonusDaysMonth   int64              `json:"ref_bonus_days_month"`
	RefBonusDaysHalfYear int64             `json:"ref_bonus_days_half_year"`
	RefBonusDaysYear    int64              `json:"ref_bonus_days_year"`
	TopReferrers        []adminTopReferrerDTO `json:"top_referrers"`
	TariffBreakdown     []adminTariffStatDTO  `json:"tariff_breakdown"`
}

type adminFortunePeriodDTO struct {
	DistinctUsers     int64            `json:"distinct_users"`
	TotalSpins        int64            `json:"total_spins"`
	FreeSpins         int64            `json:"free_spins"`
	PaidSpins         int64            `json:"paid_spins"`
	PaidCostDaysSum   int64            `json:"paid_cost_days_sum"`
	WonSubsDaysSum    int64            `json:"won_subs_days_sum"`
	WonLoyaltyXPSum   int64            `json:"won_loyalty_xp_sum"`
	WonDiscountPctSum int64            `json:"won_discount_pct_sum"`
	ByReward          map[string]int64 `json:"by_reward"`
}

type adminFortuneStatsResp struct {
	CapturedAt string                `json:"captured_at"`
	Month      adminFortunePeriodDTO `json:"month"`
	Today      adminFortunePeriodDTO `json:"today"`
	AllTime    adminFortunePeriodDTO `json:"all_time"`
}

// Stats — GET /cabinet/api/admin/stats (RequireAdmin).
func (h *AdminStatsHandler) Stats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	snap, err := h.stats.FetchAdminStatsSnapshot(r.Context())
	if err != nil {
		slog.Error("admin stats: fetch snapshot failed", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	topRef := make([]adminTopReferrerDTO, 0, len(snap.TopReferrers))
	for _, tr := range snap.TopReferrers {
		topRef = append(topRef, adminTopReferrerDTO{
			ReferrerID:   tr.ReferrerID,
			PaidReferees: tr.PaidReferees,
		})
	}

	tariffs := make([]adminTariffStatDTO, 0, len(snap.TariffBreakdown))
	for _, ts := range snap.TariffBreakdown {
		tariffs = append(tariffs, adminTariffStatDTO{
			TariffID:         ts.TariffID,
			DisplayName:      ts.DisplayName,
			SalesToday:       ts.SalesToday,
			SalesWeek:        ts.SalesWeek,
			SalesMonth:       ts.SalesMonth,
			SalesHalfYear:    ts.SalesHalfYear,
			SalesYear:        ts.SalesYear,
			SubsRevenueMonth: ts.SubsRevenueMonth,
			RevenueToday:     ts.RevenueToday,
			RevenueWeek:      ts.RevenueWeek,
			RevenueHalfYear:  ts.RevenueHalfYear,
			RevenueYear:      ts.RevenueYear,
			RevenueAll:       ts.RevenueAll,
			ActivePaidUsers:  ts.ActivePaidUsers,
		})
	}

	resp := adminStatsResp{
		CapturedAt:           snap.CapturedAt.Format(time.RFC3339),
		TotalCustomers:       snap.TotalCustomers,
		ActiveSubscriptions:  snap.ActiveSubscriptions,
		NewToday:             snap.NewToday,
		NewWeek:              snap.NewWeek,
		NewMonth:             snap.NewMonth,
		NewPrevMonth:         snap.NewPrevMonth,
		NewHalfYear:          snap.NewHalfYear,
		NewYear:              snap.NewYear,
		TrialActive:          snap.TrialActive,
		PaidActive:           snap.PaidActive,
		Inactive:             snap.Inactive,
		SalesSubToday:        snap.SalesSubToday,
		SalesSubWeek:         snap.SalesSubWeek,
		SalesSubMonth:        snap.SalesSubMonth,
		SalesSubPrevMonth:    snap.SalesSubPrevMonth,
		SalesSubHalfYear:     snap.SalesSubHalfYear,
		SalesSubYear:         snap.SalesSubYear,
		RevenueMonthRub:      snap.RevenueMonthRub,
		RevenueTodayRub:      snap.RevenueTodayRub,
		RevenueWeekRub:       snap.RevenueWeekRub,
		RevenueHalfYearRub:   snap.RevenueHalfYearRub,
		RevenueYearRub:       snap.RevenueYearRub,
		RevenueAllTimeRub:    snap.RevenueAllTimeRub,
		RevenueSubsMonthRub:  snap.RevenueSubsMonthRub,
		TransactionsToday:    snap.TransactionsToday,
		TransactionsWeek:     snap.TransactionsWeek,
		TransactionsMonth:    snap.TransactionsMonth,
		TransactionsHalfYear: snap.TransactionsHalfYear,
		TransactionsYear:     snap.TransactionsYear,
		UniquePayersDay:      snap.UniquePayersDay,
		UniquePayersWeek:     snap.UniquePayersWeek,
		UniquePayersMonth:    snap.UniquePayersMonth,
		UniquePayersHalfYear: snap.UniquePayersHalfYear,
		UniquePayersYear:     snap.UniquePayersYear,
		PaymentRubByInvoice:  snap.PaymentRubByInvoice,
		DistinctReferrers:    snap.DistinctReferrers,
		ActiveReferrers:      snap.ActiveReferrers,
		RefBonusDaysAll:      snap.RefBonusDaysAll,
		RefBonusDaysToday:    snap.RefBonusDaysToday,
		RefBonusDaysWeek:     snap.RefBonusDaysWeek,
		RefBonusDaysMonth:    snap.RefBonusDaysMonth,
		RefBonusDaysHalfYear: snap.RefBonusDaysHalfYear,
		RefBonusDaysYear:     snap.RefBonusDaysYear,
		TopReferrers:         topRef,
		TariffBreakdown:      tariffs,
	}

	writeJSON(w, http.StatusOK, resp)
}

// FortuneStats — GET /cabinet/api/admin/stats/fortune (RequireAdmin).
func (h *AdminStatsHandler) FortuneStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	snap, err := h.stats.FetchAdminFortuneStats(r.Context())
	if err != nil {
		slog.Error("admin stats: fetch fortune stats failed", "error", err.Error())
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	resp := adminFortuneStatsResp{
		CapturedAt: snap.CapturedAt.Format(time.RFC3339),
		Month:      mapFortunePeriod(snap.Month),
		Today:      mapFortunePeriod(snap.Today),
		AllTime:    mapFortunePeriod(snap.AllTime),
	}

	writeJSON(w, http.StatusOK, resp)
}

func mapFortunePeriod(p database.AdminFortunePeriodAgg) adminFortunePeriodDTO {
	byReward := p.ByReward
	if byReward == nil {
		byReward = make(map[string]int64)
	}
	return adminFortunePeriodDTO{
		DistinctUsers:     p.DistinctUsers,
		TotalSpins:        p.TotalSpins,
		FreeSpins:         p.FreeSpins,
		PaidSpins:         p.PaidSpins,
		PaidCostDaysSum:   p.PaidCostDaysSum,
		WonSubsDaysSum:    p.WonSubsDaysSum,
		WonLoyaltyXPSum:   p.WonLoyaltyXPSum,
		WonDiscountPctSum: p.WonDiscountPctSum,
		ByReward:          byReward,
	}
}
