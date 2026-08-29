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

/**
 * Серого в шкале нет намеренно: им глушится выключенный тариф, и первый
 * уровень в сером читался бы как «отключён». Зелёный тоже занят — им помечен
 * статус «активен».
 */
const RAMP: TariffTierAccent[] = [
  {
    bar: 'bg-sky-500',
    iconBox: 'bg-sky-500/15 dark:bg-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  },
  {
    bar: 'bg-rose-500',
    iconBox: 'bg-rose-500/15 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  },
  {
    bar: 'bg-amber-500',
    iconBox: 'bg-amber-500/15 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  {
    bar: 'bg-violet-500',
    iconBox: 'bg-violet-500/15 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  },
  {
    bar: 'bg-cyan-500',
    iconBox: 'bg-cyan-500/15 dark:bg-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  },
  {
    bar: 'bg-indigo-500',
    iconBox: 'bg-indigo-500/15 dark:bg-indigo-500/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  },
  {
    bar: 'bg-fuchsia-500',
    iconBox: 'bg-fuchsia-500/15 dark:bg-fuchsia-500/20',
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    badge: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400',
  },
  {
    bar: 'bg-teal-500',
    iconBox: 'bg-teal-500/15 dark:bg-teal-500/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  },
]

/**
 * Позиция в списке → цвет: первый синий, второй розовый, третий оранжевый,
 * четвёртый фиолетовый, дальше бирюзовый / индиго / фуксия / тиловый.
 * За пределами шкалы цвета идут по кругу, а не залипают на последнем.
 *
 * Считаем именно от позиции, а не от `tier_level`/`sort_order`: нумерация
 * порядка не нормирована — она бывает с нуля (в форме дефолт `?? 0`), с единицы
 * или разреженной (10/20/30). Список админки приходит с бэкенда как
 * `ORDER BY sort_order ASC, id ASC`, поэтому позиция — единственная величина,
 * которая всегда совпадает с тем, что админ видит глазами.
 */
export function tariffTierAccent(position: number): TariffTierAccent {
  const i = Math.trunc(position)
  return RAMP[((i % RAMP.length) + RAMP.length) % RAMP.length]
}
