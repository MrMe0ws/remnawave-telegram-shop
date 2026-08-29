/**
 * Цветовая лестница тарифов по `tier_level`.
 *
 * Зелёный на карточке тарифа занят статусом «активен/выключен», поэтому
 * идентичность самого тарифа кодируем отдельной шкалой: чем выше уровень,
 * тем «дороже» цвет. Так четыре карточки перестают читаться одной массой.
 */
export interface TariffTierAccent {
  /** Вертикальная полоса слева на карточке. */
  bar: string
  iconBox: string
  iconColor: string
  badge: string
}

const RAMP: TariffTierAccent[] = [
  {
    bar: 'bg-slate-400 dark:bg-slate-500',
    iconBox: 'bg-slate-500/15 dark:bg-slate-500/20',
    iconColor: 'text-slate-600 dark:text-slate-300',
    badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  },
  {
    bar: 'bg-sky-500',
    iconBox: 'bg-sky-500/15 dark:bg-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
  {
    bar: 'bg-violet-500',
    iconBox: 'bg-violet-500/15 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  },
  {
    bar: 'bg-amber-500',
    iconBox: 'bg-amber-500/15 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  {
    bar: 'bg-rose-500',
    iconBox: 'bg-rose-500/15 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
]

/** tier 1..5+ → позиция в шкале; без уровня — нейтральный первый оттенок. */
export function tariffTierAccent(tierLevel?: number | null): TariffTierAccent {
  if (tierLevel == null || tierLevel < 1) return RAMP[0]
  return RAMP[Math.min(tierLevel - 1, RAMP.length - 1)]
}
