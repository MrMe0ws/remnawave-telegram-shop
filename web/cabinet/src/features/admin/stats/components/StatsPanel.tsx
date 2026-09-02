import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import { accentTint } from '../utils/statsPalette'

/**
 * Строительные блоки страницы статистики — ровно те, что в утверждённом макете.
 *
 * Отдельный набор, а не переиспользование StatsWidgetCard, потому что у того
 * своя обвязка: цветная градиентная полоска над каждой карточкой и вложенные
 * плитки с собственными рамками. На плотной сетке из четырёх карточек это
 * читается как рябь — рамка в рамке, полоска, ещё полоска. Здесь поверхность
 * одна: карточка, заголовок с иконкой, строки.
 */

interface StatsIconChipProps {
  icon: LucideIcon
  color: string
  size?: 'sm' | 'md'
  className?: string
}

/** Квадратный значок раздела: тон иконки и его же подложка в 14%. */
export function StatsIconChip({ icon: Icon, color, size = 'md', className }: StatsIconChipProps) {
  const box = size === 'sm' ? 'size-7 rounded-lg' : 'size-8 rounded-[9px]'
  const glyph = size === 'sm' ? 'size-3.5' : 'size-[17px]'
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center', box, className)}
      style={{ backgroundColor: accentTint(color) }}
    >
      <Icon className={glyph} style={{ color }} strokeWidth={2} aria-hidden />
    </span>
  )
}

interface StatsPanelProps {
  children: ReactNode
  className?: string
  /** Внутренний отступ. compact — для карточек-плиток без заголовка. */
  padding?: 'default' | 'compact' | 'none'
}

export function StatsPanel({ children, className, padding = 'default' }: StatsPanelProps) {
  return (
    <div
      className={cn(
        'cabinet-elevated-card stats-ring flex flex-col',
        padding === 'default' && 'p-4 sm:p-5 sm:px-6',
        padding === 'compact' && 'p-4 sm:px-5 sm:py-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface StatsPanelHeadProps {
  icon: LucideIcon
  color: string
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function StatsPanelHead({
  icon,
  color,
  title,
  subtitle,
  actions,
  className,
}: StatsPanelHeadProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        <StatsIconChip icon={icon} color={color} />
        <div className="min-w-0">
          <h2 className="truncate font-heading text-[15px] font-semibold leading-tight sm:text-base">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions}
    </div>
  )
}

interface StatsStatRowProps {
  label: string
  value: ReactNode
  /** Вторая строка под значением: дельта, доля, пояснение. */
  note?: ReactNode
  accentValue?: boolean
  last?: boolean
}

/**
 * Строка «подпись слева — значение справа».
 *
 * Разделитель, а не рамка вокруг каждой метрики: три обведённые плитки внутри
 * обведённой карточки дают четыре вложенные рамки на 120 пикселей высоты.
 */
export function StatsStatRow({ label, value, note, accentValue, last }: StatsStatRowProps) {
  return (
    <div
      className={cn(
        'py-2.5',
        !last && 'border-b border-border/40',
        last && 'pb-0',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-muted-foreground sm:text-sm">
          {label}
        </span>
        <span
          className={cn(
            'shrink-0 text-[17px] font-semibold tabular-nums',
            accentValue && 'text-primary',
          )}
        >
          {value}
        </span>
      </div>
      {note && <div className="mt-1 text-xs tabular-nums">{note}</div>}
    </div>
  )
}

/** Полоска доли. Одна высота и радиус на всю страницу. */
export function StatsBar({
  percent,
  color,
  className,
}: {
  percent: number
  color: string
  className?: string
}) {
  const width = Math.max(0, Math.min(100, percent))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted/50', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  )
}

/** Квадратный маркер ряда — тот же тон, что у его полоски. */
export function StatsDot({ color }: { color: string }) {
  return (
    <span
      className="size-2.5 shrink-0 rounded-[3px]"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

interface StatsMoreProps {
  expanded: boolean
  label: string
  onToggle: () => void
}

/** Разворот таблицы с топ-5 до топ-10. */
export function StatsMore({ expanded, label, onToggle }: StatsMoreProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-border/50 pt-3 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
    >
      <span>{label}</span>
      <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
    </button>
  )
}

/** Подпись под карточкой: пояснение, что значит число и откуда оно. */
export function StatsFootnote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 border-t border-border/50 pt-3 text-xs leading-snug text-muted-foreground">
      {children}
    </p>
  )
}
