package main

import "math"

// BalanceDays converts prepaid balance (kopeks) into subscription days using
// the user's 1-month tariff price in rubles.
//
// Formula: ceil(balance_rub * 30 / price_1m_rub), minimum 1 day if balance > 0.
func BalanceDays(balanceKopeks int64, price1mRub int) int {
	if balanceKopeks <= 0 {
		return 0
	}
	if price1mRub <= 0 {
		return 1
	}
	balanceRub := float64(balanceKopeks) / 100.0
	days := int(math.Ceil(balanceRub * 30.0 / float64(price1mRub)))
	if days < 1 {
		return 1
	}
	return days
}

// TargetDays picks max(remnawave remaining days, balance-converted days).
func TargetDays(rwRemainingDays, balanceDays int) int {
	if rwRemainingDays < 0 {
		rwRemainingDays = 0
	}
	if balanceDays < 0 {
		balanceDays = 0
	}
	if rwRemainingDays > balanceDays {
		return rwRemainingDays
	}
	return balanceDays
}

// NormalizePeriodDays maps Bedolaga period_prices day keys to our months (1/3/6/12).
// Returns 0 if the day count does not map cleanly.
func NormalizePeriodDays(days int) int {
	switch {
	case days >= 28 && days <= 31:
		return 1
	case days >= 85 && days <= 95:
		return 3
	case days >= 170 && days <= 190:
		return 6
	case days >= 350 && days <= 370:
		return 12
	default:
		return 0
	}
}
