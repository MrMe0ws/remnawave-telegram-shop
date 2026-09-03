import { normalizeDecorTheme, type DecorThemeId } from './decorThemes'

/**
 * Авто-расписание декор-тем (CABINET_DECOR_AUTO_ENABLED + CABINET_DECOR_SCHEDULE).
 *
 * Правило — окно «с ДД.ММ по ДД.ММ» без года: оно повторяется каждый год, а
 * окно с переходом через 31 декабря (from > to) считается непрерывным.
 * Побеждает **первое** совпавшее правило — порядок в списке это приоритет.
 *
 * Боевую тему считает backend (`internal/config/decor_schedule.go`) и отдаёт
 * готовой в bootstrap `decor_theme`. Здесь то же самое нужно админке: показать,
 * какое окно активно сегодня, и собрать JSON для сохранения.
 */

export interface DecorScheduleRule {
  theme: DecorThemeId
  /** «MM-DD» */
  from: string
  /** «MM-DD» */
  to: string
  enabled: boolean
}

/** Синхрон с MaxDecorScheduleRules в internal/config/decor_schedule.go. */
export const DECOR_SCHEDULE_MAX_RULES = 30

/** Дней в месяце; февраль — 29: правило годовое, а не про конкретный год. */
export const DECOR_SCHEDULE_DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

/** Пресет по умолчанию — синхрон с defaultDecorSchedule (Go). */
export const DEFAULT_DECOR_SCHEDULE: readonly DecorScheduleRule[] = [
  { theme: 'new_year', from: '12-01', to: '01-31', enabled: true },
  { theme: 'valentine', from: '02-07', to: '02-21', enabled: true },
  { theme: 'halloween', from: '10-24', to: '11-07', enabled: true },
  { theme: 'black_friday', from: '11-21', to: '11-30', enabled: true },
  { theme: 'spring', from: '03-01', to: '05-31', enabled: true },
  { theme: 'summer', from: '06-01', to: '08-31', enabled: true },
]

export function defaultDecorSchedule(): DecorScheduleRule[] {
  return DEFAULT_DECOR_SCHEDULE.map((r) => ({ ...r }))
}

/** «MM-DD» → { month, day }; null для мусора. */
export function parseMonthDay(value: unknown): { month: number; day: number } | null {
  if (typeof value !== 'string') return null
  const parts = value.trim().split('-')
  if (parts.length !== 2) return null
  const month = Number(parts[0])
  const day = Number(parts[1])
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > DECOR_SCHEDULE_DAYS_IN_MONTH[month - 1]) return null
  return { month, day }
}

export function formatMonthDay(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** День, обрезанный по длине месяца: 31 марта → 30 апреля при смене месяца. */
export function clampDayToMonth(month: number, day: number): number {
  return Math.min(Math.max(day, 1), DECOR_SCHEDULE_DAYS_IN_MONTH[month - 1])
}

function monthDayCode(value: string): number {
  const parsed = parseMonthDay(value)
  return parsed ? parsed.month * 100 + parsed.day : 0
}

/** Разбор JSON из настроек. Мусор игнорируется — редактор не должен падать. */
export function parseDecorSchedule(raw: string | null | undefined): DecorScheduleRule[] {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const rules: DecorScheduleRule[] = []
  for (const item of parsed.slice(0, DECOR_SCHEDULE_MAX_RULES)) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const from = parseMonthDay(obj.from)
    const to = parseMonthDay(obj.to)
    if (!from || !to) continue
    rules.push({
      theme: normalizeDecorTheme(typeof obj.theme === 'string' ? obj.theme : null),
      from: formatMonthDay(from.month, from.day),
      to: formatMonthDay(to.month, to.day),
      // Правило без явного enabled (например дописанное руками в .env) — включено.
      enabled: obj.enabled === undefined ? true : obj.enabled === true,
    })
  }
  return rules
}

/** JSON для PATCH; пустой список — пустая строка (backend подставит пресет). */
export function serializeDecorSchedule(rules: DecorScheduleRule[]): string {
  if (rules.length === 0) return ''
  return JSON.stringify(
    rules.map((r) => ({ theme: r.theme, from: r.from, to: r.to, enabled: r.enabled })),
  )
}

/** Попадает ли дата в окно правила. */
export function decorRuleMatches(rule: DecorScheduleRule, date = new Date()): boolean {
  if (!rule.enabled) return false
  const from = monthDayCode(rule.from)
  const to = monthDayCode(rule.to)
  if (from === 0 || to === 0) return false
  const cur = (date.getMonth() + 1) * 100 + date.getDate()
  if (from <= to) return cur >= from && cur <= to
  return cur >= from || cur <= to
}

/** Индекс первого сработавшего окна; -1 если ни одно не подходит. */
export function activeDecorRuleIndex(rules: DecorScheduleRule[], date = new Date()): number {
  return rules.findIndex((rule) => decorRuleMatches(rule, date))
}

/** Тема первого сработавшего окна; null если совпадений нет. */
export function resolveScheduledDecorTheme(
  rules: DecorScheduleRule[],
  date = new Date(),
): DecorThemeId | null {
  const index = activeDecorRuleIndex(rules, date)
  return index === -1 ? null : rules[index].theme
}

/**
 * Тема кабинета из bootstrap. Расписание применяет backend
 * (`EffectiveDecorTheme`), поэтому здесь остаётся только нормализация значения.
 */
export function effectiveDecorTheme(adminTheme: string | undefined | null): DecorThemeId {
  return normalizeDecorTheme(adminTheme)
}
