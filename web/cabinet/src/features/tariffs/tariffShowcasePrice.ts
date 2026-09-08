import type { TariffItem } from '@/lib/api'
import { formatInteger, formatNumber } from '@/lib/format'

export type TariffPriceDisplayMode = 'monthly' | 'marketing'

export function showcaseMonthlyRub(periods: TariffItem[], mode: TariffPriceDisplayMode): number {
  const month1 = periods[0]
  if (mode === 'marketing') {
    const year = periods.find((p) => p.months === 12)
    if (year && year.months > 0) {
      return Math.ceil(year.price_rub / year.months)
    }
  }
  return month1?.monthly_base_rub ?? 0
}

export function formatShowcasePriceRub(n: number, mode: TariffPriceDisplayMode): string {
  if (mode === 'marketing') {
    return formatInteger(Math.ceil(n))
  }
  return formatNumber(n)
}

/** Целые рубли без копеек (витрина периодов, синяя сумма). */
export function formatRubInteger(n: number): string {
  return formatInteger(n)
}

export function anyTariffHasYearPeriod(cardPeriods: TariffItem[][]): boolean {
  return cardPeriods.some((periods) => periods.some((p) => p.months === 12))
}

export function showAnnualPriceFootnote(
  mode: TariffPriceDisplayMode,
  cardPeriods: TariffItem[][],
): boolean {
  return mode === 'marketing' && anyTariffHasYearPeriod(cardPeriods)
}

/** Вид плашки скидки на карточках сроков — CABINET_TARIFF_SAVINGS_BADGE. */
export type TariffSavingsBadgeMode = 'none' | 'corner' | 'old_price'

/**
 * Месячная база тарифа: цена периода «1 месяц». Если такого периода у тарифа
 * нет — берём ₽/мес самого короткого, иначе сравнивать не с чем.
 */
function monthlyBaseRub(periods: TariffItem[]): number {
  const month1 = periods.find((p) => p.months === 1)
  if (month1 && month1.price_rub > 0) return month1.price_rub
  return periods[0]?.monthly_base_rub ?? 0
}

/** База сравнения периода: «цена за 1 месяц × N». 0 — сравнивать не с чем. */
export function periodBaselineRub(periods: TariffItem[], months: number): number {
  const base = monthlyBaseRub(periods)
  if (!(base > 0) || months <= 1) return 0
  return base * months
}

/**
 * Экономия периода в процентах — тот же расчёт, что savingsPercent() в
 * редакторе тарифа в админке. null, если выгоды нет (или сравнивать не с чем):
 * плашку в этом случае не рисуем.
 */
export function periodSavingsPercent(periods: TariffItem[], period: TariffItem): number | null {
  const baseline = periodBaselineRub(periods, period.months)
  if (!(baseline > 0) || !(period.price_rub > 0) || period.price_rub >= baseline) return null
  return Math.round((1 - period.price_rub / baseline) * 100)
}
