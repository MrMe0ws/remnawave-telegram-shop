import { currentLocale } from '@/lib/format'

/**
 * Деньги партнёра.
 *
 * Копейки показываются, только если они есть: комиссия 20% с 1 790 ₽ — это
 * 358 ₽ ровно, и дописывать «,00» к каждой строке ленты незачем. А вот 358,40
 * округлять до 358 нельзя — партнёр сверяет сумму с процентом и найдёт
 * расхождение. Поэтому общий formatRub, который округляет до целого, здесь не
 * годится.
 */
export function formatMoney(value: number): string {
  const hasCents = Math.round(value * 100) % 100 !== 0
  return `${value.toLocaleString(currentLocale(), {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })} ₽`
}

/** Процент без хвостовых нулей: 40 %, но 12,5 %. */
export function formatPercent(value: number): string {
  return `${value.toLocaleString(currentLocale(), { maximumFractionDigits: 2 })}%`
}

/** «2026-08» → «авг» для подписей графика. */
export function formatMonthShort(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  if (!year || !month) return ym
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(currentLocale(), { month: 'short' })
}

/** «5 сентября» — дата раскрытия холда и подобные. */
export function formatDayMonth(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'long' })
}

/** «12 авг» — компактная дата для строк списков. */
export function formatDayShort(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
}
