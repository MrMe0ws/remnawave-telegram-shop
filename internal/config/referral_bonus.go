package config

// Начисление реферальных бонусов прогрессивного режима.
//
// Задача, ради которой всё это появилось: до сих пор бонус пригласившему не
// зависел от того, на какой срок платил реферал. Годовая оплата приносила
// столько же, сколько месячная, хотя стоила в разы дороже, — и тот, кто привёл
// клиента на год, получал ровно то же, что приведший на месяц.
//
// Теперь бонус пригласившему считается ПОМЕСЯЧНО:
//
//	первая оплата реферала:   first + repeat * (months - 1)
//	каждая следующая оплата:  repeat * months
//
// Первый оплаченный месяц идёт по повышенной ставке (`first`) — это премия за
// само приведение клиента, она платится один раз. Все остальные месяцы, включая
// остаток длинного первого чека, идут по обычной ставке (`repeat`).
//
// Приглашённый получает фиксированный приветственный бонус один раз, на своей
// первой оплате, и его размер от срока не зависит: это подарок за приход по
// ссылке, а не доля от чека.
//
// Отдельной настройки-множителя здесь нет намеренно. Формула полностью
// определяется двумя уже существующими числами — REFERRAL_FIRST_REFERRER_DAYS и
// REFERRAL_REPEAT_REFERRER_DAYS, — и любой третий регулятор дублировал бы их.

// ReferralBonus — начисление за одну оплату реферала, обеим сторонам сразу.
type ReferralBonus struct {
	// Дни пригласившему за эту оплату.
	ReferrerDays int
	// Ставка за первый оплаченный месяц; ненулевая только на первой оплате
	// реферала. Хранится для журнала: по паре ставок начисление разбирается
	// обратно, а по одному итоговому числу — уже нет.
	FirstMonthDays int
	// Ставка за каждый месяц сверх первого.
	PerMonthDays int
	// Дни приглашённому. Ненулевые только на его первой оплате.
	RefereeDays int
}

// ReferralBonusForPayment — вся политика начисления в одном месте.
//
// months — длина оплаченного периода, isFirstPayment — это ли первая
// оплаченная подписка реферала.
func ReferralBonusForPayment(months int, isFirstPayment bool) ReferralBonus {
	if months < 1 {
		// Покупка без срока — доп. устройства и прочее. Бонуса нет ни у кого.
		return ReferralBonus{}
	}

	first := nonNegative(ReferralFirstReferrerDays())
	repeat := nonNegative(ReferralRepeatReferrerDays())

	if !ReferralScaleByMonths() {
		// Рубильник выключен — прежнее поведение: фиксированное начисление
		// независимо от длины оплаченного периода.
		if isFirstPayment {
			return ReferralBonus{
				ReferrerDays:   first,
				FirstMonthDays: first,
				RefereeDays:    nonNegative(ReferralFirstRefereeDays()),
			}
		}
		return ReferralBonus{ReferrerDays: repeat, PerMonthDays: repeat}
	}

	if isFirstPayment {
		return ReferralBonus{
			ReferrerDays:   first + repeat*(months-1),
			FirstMonthDays: first,
			PerMonthDays:   repeat,
			RefereeDays:    nonNegative(ReferralFirstRefereeDays()),
		}
	}
	return ReferralBonus{
		ReferrerDays: repeat * months,
		PerMonthDays: repeat,
	}
}

// ReferralScaleByMonths — рубильник помесячного начисления. Выключенный
// возвращает прежнее поведение целиком: бонус не зависит от оплаченного срока.
// Нужен как быстрый откат, если экономика новой схемы не сойдётся.
func ReferralScaleByMonths() bool {
	return conf.referralScaleByMonths
}

func nonNegative(v int) int {
	if v < 0 {
		return 0
	}
	return v
}
