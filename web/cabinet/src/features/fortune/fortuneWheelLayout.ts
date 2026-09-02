import type { FortuneSectorDTO } from '@/lib/api'

import { FORTUNE_PRIZE_SORT_ORDER, sortFortuneSectorsByIndex } from '@/features/fortune/fortunePrizeVisuals'

/**
 * Раскладка секторов по слотам диска.
 *
 * API отдаёт сектора возрастающей лесенкой по ценности (`FortuneRewardTypesOrder` на бэке),
 * и раньше слот на колесе был равен `index` из API — призы стояли строго по порядку.
 * Здесь между ними появляется перестановка: чисто визуальная, на RNG (веса, сервер) не влияет.
 *
 * Перестановка детерминированная, а не случайная: колесо должно выглядеть одинаково между
 * визитами, иначе «приз переехал» читается как подкрутка.
 */

/** 1 − 1/φ: доля от числа секторов, дающая максимально равномерный разброс. */
const GOLDEN_FRACTION = 0.381966

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x
}

/**
 * Шаг обхода слотов: ≈38% от `n`, ближайший взаимно простой с `n`.
 * Взаимная простота гарантирует, что `rank * step % n` — биекция, то есть каждый слот занят ровно раз.
 */
export function scatterStep(n: number): number {
  if (n < 3) return 1
  const start = Math.max(1, Math.round(n * GOLDEN_FRACTION))
  for (let d = 0; d < n; d++) {
    for (const s of [start + d, start - d]) {
      if (s >= 1 && s < n && gcd(s, n) === 1) return s
    }
  }
  return 1
}

/** Ранг по ценности приза; неизвестные типы уходят в конец. */
function prizeRank(rewardType: string): number {
  const i = FORTUNE_PRIZE_SORT_ORDER.indexOf(rewardType)
  return i === -1 ? FORTUNE_PRIZE_SORT_ORDER.length : i
}

/**
 * Сектора в порядке слотов на диске (слот 0 — от 0°, дальше по часовой).
 *
 * Соседние по ценности призы разводятся на `scatterStep` слотов, поэтому крупные не липнут
 * друг к другу и цвета соседей не идут градиентом. При 10 секторах шаг = 3:
 * `+180д, −3%, +5д, +30д, XP, +3д, +15д, micro, −5%, +7д`.
 */
export function arrangeFortuneSlots(sectors: FortuneSectorDTO[]): FortuneSectorDTO[] {
  const byIndex = sortFortuneSectorsByIndex(sectors)
  const n = byIndex.length
  if (n < 3) return byIndex

  const byValue = [...byIndex].sort((a, b) => {
    const d = prizeRank(a.reward_type) - prizeRank(b.reward_type)
    return d !== 0 ? d : a.index - b.index
  })

  const step = scatterStep(n)
  const slots = new Array<FortuneSectorDTO | undefined>(n)
  byValue.forEach((s, rank) => {
    slots[(rank * step) % n] = s
  })

  const filled = slots.filter((s): s is FortuneSectorDTO => s !== undefined)
  return filled.length === n ? filled : byIndex
}

/** Слот, в котором стоит сектор с `index` из API (`sector_index` в ответе на спин). */
export function slotIndexOfSector(slots: FortuneSectorDTO[], sectorIndex: number): number {
  const i = slots.findIndex((s) => s.index === sectorIndex)
  return i === -1 ? 0 : i
}
