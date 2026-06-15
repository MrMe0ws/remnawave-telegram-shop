import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface StatsMetricItem {
  label: string
  value: string | number
  /** Доп. текст справа от значения, напр. «(13.3%)» */
  suffix?: string
  /** Процент изменения к пред. периоду — только для метрик роста */
  growthPct?: string
  /** Тренд роста/падения — показывается только вместе с growthPct */
  trend?: 'up' | 'down' | 'neutral'
  /** Скрыть на узких экранах (показывается в «Показать все») */
  compactHidden?: boolean
}

interface StatsMetricRowProps {
  item: StatsMetricItem
  className?: string
}

export function StatsMetricRow({ item, className }: StatsMetricRowProps) {
  const TrendIcon =
    item.trend === 'up' ? TrendingUp : item.trend === 'down' ? TrendingDown : Minus

  return (
    <div
      className={cn(
        'flex min-h-8 items-center justify-between gap-2 py-0.5 text-sm',
        className,
      )}
    >
      <dt className="text-muted-foreground">{item.label}</dt>
      <dd className="flex items-center gap-1.5 font-medium tabular-nums">
        {item.growthPct && item.trend && item.trend !== 'neutral' && (
          <TrendIcon
            className={cn(
              'size-3.5 shrink-0',
              item.trend === 'up' ? 'text-emerald-500' : 'text-rose-500',
            )}
            aria-hidden
          />
        )}
        <span>{item.value}</span>
        {item.suffix && (
          <span className="text-xs font-normal text-muted-foreground">{item.suffix}</span>
        )}
        {item.growthPct && (
          <span
            className={cn(
              'text-xs font-medium',
              item.trend === 'up' && 'text-emerald-500',
              item.trend === 'down' && 'text-rose-500',
              item.trend === 'neutral' && 'text-muted-foreground',
            )}
          >
            ({item.growthPct})
          </span>
        )}
      </dd>
    </div>
  )
}
