/**
 * Единая шкала тревоги для показателей подписки.
 *
 * До этого пороги жили по отдельности и расходились: тон срока действия
 * считался строгими неравенствами (`days < 7`), а призыв продлить —
 * нестрогими (`days <= 7`). Из-за этого ровно на семи днях страница уже
 * показывала «Продлить», а блок даты был ещё зелёным. Здесь пороги общие,
 * и от них зависят и цвет, и кнопки.
 *
 * Пороги трафика взяты из прежнего `trafficBarFillClass` — 70% и 90%.
 */

export type ToneLevel = 'calm' | 'warn' | 'danger'

export const WARN_DAYS = 7
export const DANGER_DAYS = 3
const WARN_TRAFFIC_PCT = 70
const DANGER_TRAFFIC_PCT = 90

/** Осталось дней. null или неположительное — подписка истекла. */
export function daysTone(days: number | null | undefined): ToneLevel {
  if (days == null || days <= 0) return 'danger'
  if (days <= DANGER_DAYS) return 'danger'
  if (days <= WARN_DAYS) return 'warn'
  return 'calm'
}

/** Доля израсходованного трафика. null — безлимит, тревожиться не о чем. */
export function trafficTone(percent: number | null | undefined): ToneLevel {
  if (percent == null) return 'calm'
  if (percent >= DANGER_TRAFFIC_PCT) return 'danger'
  if (percent >= WARN_TRAFFIC_PCT) return 'warn'
  return 'calm'
}

/**
 * Устройства до красного не эскалируют.
 *
 * Занятые слоты — не поломка, а обычная граница: пользователь освободит слот
 * или докупит. Красный сообщал бы о проблеме, которой нет. Янтарный только
 * когда свободных слотов не осталось совсем.
 */
export function devicesTone(used: number, limit: number): ToneLevel {
  if (limit <= 0) return 'calm'
  return used >= limit ? 'warn' : 'calm'
}

/** Показывать ли призыв продлить: со ступени «предупреждение» и ниже. */
export function shouldOfferRenew(days: number | null | undefined): boolean {
  return daysTone(days) !== 'calm'
}
