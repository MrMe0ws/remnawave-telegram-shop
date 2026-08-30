package config

import "testing"

// withReferralBonusConfig подменяет ставки и рубильник на время теста.
func withReferralBonusConfig(t *testing.T, firstReferrer, firstReferee, repeat int, scale bool) {
	t.Helper()
	pFR, pFE, pR, pS := conf.referralFirstReferrerDays, conf.referralFirstRefereeDays,
		conf.referralRepeatReferrerDays, conf.referralScaleByMonths
	t.Cleanup(func() {
		conf.referralFirstReferrerDays = pFR
		conf.referralFirstRefereeDays = pFE
		conf.referralRepeatReferrerDays = pR
		conf.referralScaleByMonths = pS
	})
	conf.referralFirstReferrerDays = firstReferrer
	conf.referralFirstRefereeDays = firstReferee
	conf.referralRepeatReferrerDays = repeat
	conf.referralScaleByMonths = scale
}

// Задача, ради которой всё затевалось: годовая оплата реферала должна приносить
// пригласившему кратно больше месячной, а не столько же.
func TestReferralBonusReferrerAccruesPerMonth(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, true)

	cases := []struct {
		months int
		first  bool
		want   int
		note   string
	}{
		// Первая оплата: 7 за первый месяц + 3 за каждый следующий.
		{1, true, 7, "7"},
		{3, true, 13, "7+3*2"},
		{6, true, 22, "7+3*5"},
		{12, true, 40, "7+3*11"},
		// Последующие: 3 за каждый оплаченный месяц.
		{1, false, 3, "3*1"},
		{6, false, 18, "3*6"},
		{12, false, 36, "3*12"},
	}
	for _, c := range cases {
		got := ReferralBonusForPayment(c.months, c.first).ReferrerDays
		if got != c.want {
			t.Errorf("months=%d first=%v: got %d days, want %d (%s)", c.months, c.first, got, c.want, c.note)
		}
	}
}

// Приглашённый получает фиксированный приветственный бонус: он платится за факт
// прихода по ссылке, а не как доля от чека.
func TestReferralBonusRefereeIsFlat(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, true)

	for _, months := range []int{1, 3, 6, 12} {
		if got := ReferralBonusForPayment(months, true).RefereeDays; got != 7 {
			t.Errorf("months=%d: referee got %d days, want a flat 7", months, got)
		}
	}
}

// Приветственный бонус разовый — повторные оплаты приглашённому ничего не несут.
func TestReferralBonusRefereeOnlyOnFirstPayment(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, true)

	if got := ReferralBonusForPayment(12, false).RefereeDays; got != 0 {
		t.Errorf("repeat payment granted the referee %d days, want 0", got)
	}
}

// Ставки уезжают в журнал, по ним начисление разбирается обратно.
func TestReferralBonusReportsRates(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, true)

	first := ReferralBonusForPayment(6, true)
	if first.FirstMonthDays != 7 || first.PerMonthDays != 3 {
		t.Errorf("first payment rates: got first=%d per=%d, want 7 and 3", first.FirstMonthDays, first.PerMonthDays)
	}
	if want := first.FirstMonthDays + first.PerMonthDays*5; first.ReferrerDays != want {
		t.Errorf("rates do not reconstruct the total: %d != %d", first.ReferrerDays, want)
	}

	repeat := ReferralBonusForPayment(6, false)
	if repeat.FirstMonthDays != 0 || repeat.PerMonthDays != 3 {
		t.Errorf("repeat payment rates: got first=%d per=%d, want 0 and 3", repeat.FirstMonthDays, repeat.PerMonthDays)
	}
	if want := repeat.PerMonthDays * 6; repeat.ReferrerDays != want {
		t.Errorf("rates do not reconstruct the total: %d != %d", repeat.ReferrerDays, want)
	}
}

// Рубильник возвращает прежнее поведение целиком.
func TestReferralBonusScalingDisabled(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, false)

	for _, months := range []int{1, 3, 6, 12} {
		b := ReferralBonusForPayment(months, true)
		if b.ReferrerDays != 7 || b.RefereeDays != 7 {
			t.Errorf("scaling off, first payment months=%d: got %d/%d, want a flat 7/7",
				months, b.ReferrerDays, b.RefereeDays)
		}
		if got := ReferralBonusForPayment(months, false).ReferrerDays; got != 3 {
			t.Errorf("scaling off, repeat payment months=%d: got %d, want a flat 3", months, got)
		}
	}
}

// Покупка без срока — доп. устройства и прочее: бонуса нет ни у кого.
func TestReferralBonusNonSubscriptionPurchase(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, true)

	for _, months := range []int{0, -1} {
		b := ReferralBonusForPayment(months, true)
		if b.ReferrerDays != 0 || b.RefereeDays != 0 {
			t.Errorf("months=%d granted %+v, want nothing", months, b)
		}
	}
}

// Отрицательные настройки не должны превращаться в отрицательные начисления —
// иначе продление ушло бы в минус и укоротило подписку.
func TestReferralBonusNegativeConfigIsClamped(t *testing.T) {
	withReferralBonusConfig(t, -5, -5, -5, true)

	b := ReferralBonusForPayment(12, true)
	if b.ReferrerDays < 0 || b.RefereeDays < 0 {
		t.Errorf("negative config produced a negative grant: %+v", b)
	}
}

// Нулевые настройки означают «бонусов нет», а не «начислить хоть что-нибудь».
func TestReferralBonusZeroConfigGrantsNothing(t *testing.T) {
	withReferralBonusConfig(t, 0, 0, 0, true)

	for _, first := range []bool{true, false} {
		b := ReferralBonusForPayment(12, first)
		if b.ReferrerDays != 0 || b.RefereeDays != 0 {
			t.Errorf("first=%v: zero config granted %+v, want nothing", first, b)
		}
	}
}

// Разбивать покупку не должно быть выгоднее, чем брать длинный период сразу.
//
// Свойство держится потому, что первый месяц оплачивается по повышенной ставке
// ровно один раз за реферала. Разбивка «месяц, потом остаток» даёт
// пригласившему на repeat дней больше, но стоит покупателю лишнего месяца
// подписки — то есть магазин получает больше выручки, чем отдаёт днями.
// Проверяем, что перекос не выходит за эту одну ставку.
func TestReferralBonusSplittingGainIsBounded(t *testing.T) {
	withReferralBonusConfig(t, 7, 7, 3, true)

	direct := ReferralBonusForPayment(12, true).ReferrerDays
	split := ReferralBonusForPayment(1, true).ReferrerDays + ReferralBonusForPayment(12, false).ReferrerDays

	if gain := split - direct; gain != 3 {
		t.Errorf("splitting a year into 1+12 months gains the referrer %d days (%d vs %d), want exactly one repeat rate (3)",
			gain, split, direct)
	}
}
