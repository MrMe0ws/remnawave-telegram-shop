/** Доля num от den в процентах (как pctStr в internal/handler/admin_stats.go). */
export function pctOf(num: number, den: number): string {
  if (den <= 0) return '0.0'
  return (num * 100 / den).toFixed(1)
}

/** Рост cur относительно prev в процентах (как growthPct в internal/handler/admin_stats.go). */
export function growthPct(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0
  return ((cur - prev) * 100) / prev
}

export function formatGrowthPct(cur: number, prev: number): string {
  const pct = growthPct(cur, prev)
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function growthTrend(cur: number, prev: number): 'up' | 'down' | 'neutral' {
  if (cur > prev) return 'up'
  if (cur < prev) return 'down'
  return 'neutral'
}

export function formatRub(value: number, locale = 'ru-RU'): string {
  return value.toLocaleString(locale, { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

export function statsNumberLocale(lang: string | undefined): string {
  return lang?.startsWith('en') ? 'en-GB' : 'ru-RU'
}

/** Дробное число в локали интерфейса: «4,8» в русском, «4.8» в английском. */
export function formatDecimal(value: number, locale = 'ru-RU', digits = 1): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Доля в процентах, тоже в локали интерфейса. */
export function formatPct(num: number, den: number, locale = 'ru-RU'): string {
  if (den <= 0) return formatDecimal(0, locale)
  return formatDecimal((num * 100) / den, locale)
}
