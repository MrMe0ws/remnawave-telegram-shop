/**
 * Палитра статистики.
 *
 * Те же значения, что в утверждённом макете. Цвет здесь кодирует принадлежность
 * (касса, тариф, шаг воронки), а не величину, поэтому набор фиксированный и
 * назначается по порядку — цикл по хешу давал бы разным сущностям один тон на
 * соседних строках.
 *
 * Тона выбраны так, чтобы читаться и на тёмной подложке кабинета, и на светлой:
 * они лежат в середине шкалы светлоты. Текст ими не красим — подписи и числа
 * всегда носят токены темы, цвет несёт только маркер рядом с ними.
 */
export const STATS_ACCENT = {
  blue: '#3987E5',
  cyan: '#0EADF1',
  green: '#199E70',
  amber: '#C98500',
  orange: '#D95926',
  violet: '#7C5CE0',
  red: '#D03B3B',
} as const

export type StatsAccent = keyof typeof STATS_ACCENT

/** Порядок назначения тонов рядам: кассам, тарифам, наградам колеса. */
export const STATS_SERIES: readonly string[] = [
  STATS_ACCENT.cyan,
  STATS_ACCENT.blue,
  STATS_ACCENT.green,
  STATS_ACCENT.amber,
  STATS_ACCENT.violet,
  STATS_ACCENT.orange,
  STATS_ACCENT.red,
]

export function seriesColor(index: number): string {
  return STATS_SERIES[index % STATS_SERIES.length]
}

/** Подложка иконки — тот же тон, приглушённый до фона. */
export function accentTint(color: string, alpha = 0.14): string {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
