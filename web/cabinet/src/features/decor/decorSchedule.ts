import { normalizeDecorTheme, type DecorThemeId } from './decorThemes'

/**
 * Окна авто-включения декор-тем по календарю (задел на будущее).
 * MVP: админ включает CABINET_DECOR_THEME вручную; авто выключено.
 */
export const DECOR_AUTO_WINDOWS: ReadonlyArray<{
  theme: Exclude<DecorThemeId, 'off' | 'neon'>
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
}> = [
  { theme: 'new_year', startMonth: 12, startDay: 15, endMonth: 1, endDay: 15 },
  { theme: 'valentine', startMonth: 2, startDay: 7, endMonth: 2, endDay: 16 },
  { theme: 'spring', startMonth: 3, startDay: 1, endMonth: 5, endDay: 31 },
  { theme: 'summer', startMonth: 6, startDay: 1, endMonth: 8, endDay: 31 },
  { theme: 'halloween', startMonth: 10, startDay: 20, endMonth: 10, endDay: 31 },
  { theme: 'black_friday', startMonth: 11, startDay: 27, endMonth: 11, endDay: 30 },
]

/** Включить авто-расписание (будущий релиз). */
export const DECOR_AUTO_SCHEDULE_ENABLED = false

function isInWindow(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number,
): boolean {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const cur = m * 100 + d
  const start = startMonth * 100 + startDay
  const end = endMonth * 100 + endDay
  if (start <= end) return cur >= start && cur <= end
  return cur >= start || cur <= end
}

/** Тема по календарю; null если авто выключено или нет совпадения. */
export function resolveAutoDecorTheme(date = new Date()): DecorThemeId | null {
  if (!DECOR_AUTO_SCHEDULE_ENABLED) return null
  for (const w of DECOR_AUTO_WINDOWS) {
    if (isInWindow(date, w.startMonth, w.startDay, w.endMonth, w.endDay)) {
      return w.theme
    }
  }
  return null
}

/** Ручная тема из админки; при off — задел под авто (пока всегда off). */
export function effectiveDecorTheme(adminTheme: string | undefined | null, date = new Date()): DecorThemeId {
  const manual = normalizeDecorTheme(adminTheme)
  if (manual !== 'off') return manual
  return resolveAutoDecorTheme(date) ?? 'off'
}
