import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { StatsIconChip } from './StatsPanel'

interface StatsKpiCardProps {
  icon: LucideIcon
  color: string
  label: string
  value: string
  /** Строка под числом: либо дельта к прошлому периоду, либо пояснение. */
  hint?: ReactNode
  className?: string
}

/**
 * Крупная метрика верхнего ряда: значок, подпись, число, строка под ним.
 *
 * Число набрано заголовочным шрифтом и заметно крупнее подписи — на такой
 * карточке взгляд должен цепляться за величину, а не за её название.
 */
export function StatsKpiCard({ icon, color, label, value, hint, className }: StatsKpiCardProps) {
  return (
    <div className={cn('cabinet-elevated-card flex flex-col gap-2 px-5 py-4', className)}>
      <div className="flex items-center gap-2.5">
        <StatsIconChip icon={icon} color={color} />
        <span className="min-w-0 truncate text-[13px] text-muted-foreground">{label}</span>
      </div>
      <div className="font-heading text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-3xl">
        {value}
      </div>
      {hint && <div className="text-[13px] leading-snug">{hint}</div>}
    </div>
  )
}

/**
 * Мелкая производная карточка: подпись со значком, значение, пояснение.
 * Отличается от KPI ростом числа — это второй эшелон, а не заголовок экрана.
 */
export function StatsMiniCard({
  icon: Icon,
  color,
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  icon: LucideIcon
  color: string
  label: string
  value: string
  hint?: string
  valueClassName?: string
  className?: string
}) {
  return (
    <div className={cn('cabinet-elevated-card px-5 py-4', className)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
        <span className="min-w-0 truncate text-[13px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn('mt-1.5 truncate text-[22px] font-semibold tabular-nums', valueClassName)}>
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Дельта к прошлому периоду: знак, цвет и подпись «к чему сравниваем». */
export function StatsDelta({
  pct,
  note,
  trend,
}: {
  pct: string
  note?: string
  trend: 'up' | 'down' | 'neutral'
}) {
  return (
    <span className="tabular-nums">
      <span
        className={cn(
          'font-semibold',
          trend === 'up' && 'text-emerald-500',
          trend === 'down' && 'text-rose-500',
          trend === 'neutral' && 'text-muted-foreground',
        )}
      >
        {pct}
      </span>
      {note && <span className="ml-1.5 font-normal text-muted-foreground">{note}</span>}
    </span>
  )
}
