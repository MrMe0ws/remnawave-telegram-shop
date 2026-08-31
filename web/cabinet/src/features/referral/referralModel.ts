import type { ReferralsResponse } from '@/lib/api'

/** Горизонт расчёта: год — тот срок, на котором видно накопление продлений. */
export const REFERRAL_HORIZON_MONTHS = 12

/**
 * Сколько дней считаем «бесплатным месяцем».
 *
 * Календарный месяц бывает и 28, и 31 день, но 30 — та единица, в которой
 * продаются тарифы и в которой человек и так думает о подписке.
 */
export const DAYS_IN_FREE_MONTH = 30

export interface ReferralBonusRules {
  /** Дней пригласившему за первую (или первую месячную) оплату реферала. */
  first: number
  /** Дней пригласившему за каждое следующее продление. 0 — начисление разовое. */
  repeat: number
  /** Дней самому приглашённому при регистрации. 0 — подарка нет. */
  referee: number
}

/**
 * Правила программы из ответа API.
 *
 * Режимов два, и различаются они принципиально: прогрессивный платит и за
 * продления, обычный — только за первую оплату. Дальше по коду это различие
 * выражается одним `repeat === 0`, поэтому разбор режима собран здесь, а не
 * растащен по компонентам.
 */
export function referralBonusRules(data: ReferralsResponse): ReferralBonusRules {
  if (data.referral_mode === 'progressive') {
    return {
      first: data.referral_first_referrer_days ?? 0,
      repeat: data.referral_repeat_referrer_days ?? 0,
      referee: data.referral_first_referee_days ?? 0,
    }
  }
  return {
    first: data.referral_bonus_days_default ?? data.stats.referral_days_per_paid_default ?? 0,
    repeat: 0,
    referee: 0,
  }
}

/**
 * Прибавка бонусных дней по месяцам.
 *
 * Модель: друзья приходят по одному в месяц, каждый оплачивает подписку
 * помесячно и остаётся. В месяце m новый друг даёт первую оплату, а все
 * пришедшие раньше — продление. Отсюда и рост: база накапливается, а начисление
 * с неё повторяется.
 *
 * Отток не учитываем — об этом прямо говорит подпись под графиком. Врать
 * калькулятором нельзя: человек проверит его по своей же статистике.
 */
export function referralMonthlyDays(friends: number, rules: ReferralBonusRules): number[] {
  return Array.from({ length: REFERRAL_HORIZON_MONTHS }, (_, i) => {
    const month = i + 1
    const joined = month <= friends ? 1 : 0
    const renewing = Math.min(month - 1, friends)
    return joined * rules.first + renewing * rules.repeat
  })
}

/** Нарастающий итог ряда. */
export function cumulative(values: number[]): number[] {
  let acc = 0
  return values.map((v) => (acc += v))
}

/** Целых бесплатных месяцев в накопленных днях и остаток до следующего. */
export function freeMonthsFromDays(days: number): { months: number; remainder: number } {
  const safe = Math.max(0, Math.floor(days))
  return { months: Math.floor(safe / DAYS_IN_FREE_MONTH), remainder: safe % DAYS_IN_FREE_MONTH }
}

/**
 * Сколько ещё нужно событий, чтобы закрыть текущий месяц.
 *
 * Возвращает null, если такого начисления в программе нет: в обычном режиме
 * продлений не существует, и обещать «ещё три продления» было бы обманом.
 */
export function eventsToCloseMonth(remainingDays: number, perEvent: number): number | null {
  if (perEvent <= 0) return null
  return Math.ceil(remainingDays / perEvent)
}
