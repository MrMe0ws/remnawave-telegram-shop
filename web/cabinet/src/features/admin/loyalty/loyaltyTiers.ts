import type { AdminLoyaltyTier } from '../hooks/useAdminLoyalty'

/**
 * Цвет уровня — только шкала «выше / ниже», без смысла вроде «бронза / золото»:
 * названий у уровней нет, клиент видит «Уровень N». Первый уровень всегда
 * серый, последний всегда фуксия, промежуточные раскладываются между ними,
 * поэтому при трёх уровнях лестница выглядит так же законченно, как при шести.
 */
const TONES = [
  { text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/15', bar: 'bg-slate-400' },
  { text: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-400/15', bar: 'bg-sky-300' },
  { text: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-500/15', bar: 'bg-sky-400' },
  { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/15', bar: 'bg-indigo-400' },
  { text: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/15', bar: 'bg-violet-400' },
  { text: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-500/15', bar: 'bg-fuchsia-400' },
] as const

export type LoyaltyTierTone = (typeof TONES)[number]

export function loyaltyTierTone(index: number, count: number): LoyaltyTierTone {
  if (count <= 1) return TONES[0]
  const step = Math.round((index * (TONES.length - 1)) / (count - 1))
  return TONES[Math.min(TONES.length - 1, Math.max(0, step))]
}

/** Уровни по возрастанию порога: так их считает бэк, и так идёт лестница. */
export function sortTiersByXp(tiers: AdminLoyaltyTier[]): AdminLoyaltyTier[] {
  return [...tiers].sort((a, b) => a.xp_min - b.xp_min || a.sort_order - b.sort_order)
}

/** Базовый уровень (sort_order 0) бэк удалить не даёт; у него порог всегда 0. */
export function isBaseTier(tier: Pick<AdminLoyaltyTier, 'sort_order'>): boolean {
  return tier.sort_order === 0
}

/**
 * Соседи по лестнице для формы: между ними должны лечь порог и скидка.
 * Новый уровень бэк всегда ставит последним (sort_order = max + 1), поэтому у
 * него сосед только снизу — текущий верхний уровень.
 */
export function tierNeighbors(
  sorted: AdminLoyaltyTier[],
  editing: AdminLoyaltyTier | null,
): { prev: AdminLoyaltyTier | null; next: AdminLoyaltyTier | null } {
  if (!editing) {
    return { prev: sorted.length ? sorted[sorted.length - 1] : null, next: null }
  }
  const i = sorted.findIndex((t) => t.id === editing.id)
  if (i < 0) return { prev: null, next: null }
  return { prev: sorted[i - 1] ?? null, next: sorted[i + 1] ?? null }
}

/**
 * Где уровень лежит на общей шкале XP, в процентах. Верхнему уровню справа
 * оставляем хвост, иначе его полоска схлопнулась бы в точку.
 */
export function tierTrack(sorted: AdminLoyaltyTier[], index: number): { left: number; width: number } {
  const last = sorted[sorted.length - 1]
  const scale = last && last.xp_min > 0 ? last.xp_min * 1.15 : 1
  const from = sorted[index].xp_min
  const to = sorted[index + 1]?.xp_min ?? scale
  const left = Math.min(100, (from / scale) * 100)
  const width = Math.max(2, Math.min(100 - left, ((to - from) / scale) * 100))
  return { left, width }
}
