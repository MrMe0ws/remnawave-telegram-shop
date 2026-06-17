import type { TariffItem } from '@/lib/api'

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
    return Math.ceil(n).toLocaleString('ru-RU', { maximumFractionDigits: 0 })
  }
  return n.toLocaleString('ru-RU')
}

/** Целые рубли без копеек (витрина периодов, синяя сумма). */
export function formatRubInteger(n: number): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
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
