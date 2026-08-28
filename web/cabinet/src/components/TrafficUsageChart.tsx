import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate } from '@/lib/utils'
import type { TrafficUsageResponse } from '@/lib/api'

/**
 * График расхода трафика за расчётный период.
 *
 * Рисуется чистым SVG: recharts весит около полумегабайта и живёт только в
 * админке — тянуть его на главную ради одной ломаной незачем.
 *
 * Показывается и на безлимитном тарифе: график про динамику по дням, а не про
 * долю от лимита, знаменатель ему не нужен. Для безлимита это вообще
 * единственная информация о трафике — полосы у него нет.
 */
export function TrafficUsageChart({
  data,
  loading,
  lang,
  className,
}: {
  data: TrafficUsageResponse | undefined
  loading: boolean
  lang: string
  className?: string
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card className={cn('cabinet-elevated-card', className)}>
        <CardContent className="px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-3 h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  /*
   * Карточку показываем, только когда есть что рисовать.
   *
   * Точек меньше двух — линию не построить (шаг считается как 100/(n-1)).
   * Все точки нулевые — линия ложится по нулю и читается как поломка графика,
   * хотя на деле человек просто ещё не расходовал трафик. Проверяем именно
   * точки, а не total_bytes: панель может не отдать сумму, а ряд отдать.
   */
  if (!data?.enabled || data.points.length < 2) return null
  if (!data.points.some((p) => p > 0)) return null

  return (
    <Card className={cn('cabinet-elevated-card', className)}>
      <CardContent className="px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('dashboard.usageChartTitle')}</p>
            {data.period_start && (
              <p className="text-xs text-muted-foreground">
                {t('dashboard.usageChartSince', { date: formatDate(data.period_start, lang) })}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatGb(data.total_bytes)} {t('dashboard.gigabytes')}
          </span>
        </div>
        <Sparkline points={data.points} className="mt-3" />
      </CardContent>
    </Card>
  )
}

function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 100) return String(Math.round(gb))
  return gb.toFixed(1)
}

function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const max = Math.max(...points, 1)
  const step = 100 / (points.length - 1)
  const line = points.map((p, i) => `${(i * step).toFixed(2)},${(40 - (p / max) * 34).toFixed(2)}`).join(' ')

  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className={cn('h-16 w-full', className)}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="cabinet-usage-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${line} 100,40`} fill="url(#cabinet-usage-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
