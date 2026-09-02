import type { LucideIcon } from 'lucide-react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { statsCardAccentStyles, type StatsCardAccent } from '../utils/statsCardAccents'

export interface StatsGroupItem {
  icon: LucideIcon
  label: string
  value: string
  /** Пояснение под значением: доля, из чего сложилось, за какой период. */
  hint?: string
  growthPct?: string
  trend?: 'up' | 'down' | 'neutral'
}

interface StatsGroupCardProps {
  icon: LucideIcon
  title: string
  accent: StatsCardAccent
  gradient: string
  items: StatsGroupItem[]
  footer?: React.ReactNode
  className?: string
}

/**
 * Блок «Обзора»: заголовок с иконкой и несколько метрик.
 *
 * На телефоне метрика — строка «подпись слева, число справа»; с sm и шире —
 * плитка с числом под подписью. Одна и та же разметка в обоих случаях: на узком
 * экране вертикальные плитки растянули бы карточку на три экрана.
 */
export function StatsGroupCard({
  icon: Icon,
  title,
  accent,
  gradient,
  items,
  footer,
  className,
}: StatsGroupCardProps) {
  const accentStyle = statsCardAccentStyles[accent]

  return (
    <Card className={cn('cabinet-elevated-card overflow-hidden', className)}>
      <div className={cn('h-1', gradient)} />
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            accentStyle.boxClassName,
          )}
        >
          <Icon className={cn('size-4', accentStyle.iconClassName)} />
        </div>
        <p className="truncate text-base font-semibold">{title}</p>
      </div>
      <div className="px-4 pb-4">
        <div
          className={cn(
            'grid gap-2',
            items.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          )}
        >
          {items.map((item) => (
            <StatsGroupTile key={item.label} item={item} />
          ))}
        </div>
        {footer}
      </div>
    </Card>
  )
}

function StatsGroupTile({ item }: { item: StatsGroupItem }) {
  const ItemIcon = item.icon
  const TrendIcon =
    item.trend === 'up' ? TrendingUp : item.trend === 'down' ? TrendingDown : Minus

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 sm:block">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <ItemIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{item.label}</span>
      </div>
      <div className="shrink-0 text-right sm:mt-1 sm:text-left">
        <div className="flex items-baseline justify-end gap-1.5 sm:justify-start">
          <span className="text-lg font-semibold tabular-nums sm:text-xl">{item.value}</span>
          {item.growthPct && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                item.trend === 'up' && 'text-emerald-500',
                item.trend === 'down' && 'text-rose-500',
                item.trend === 'neutral' && 'text-muted-foreground',
              )}
            >
              <TrendIcon className="size-3 shrink-0" aria-hidden />
              {item.growthPct}
            </span>
          )}
        </div>
        {item.hint && (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{item.hint}</p>
        )}
      </div>
    </div>
  )
}
