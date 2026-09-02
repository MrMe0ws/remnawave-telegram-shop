import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart as LineChartIcon, ShoppingCart, UserPlus, Wallet } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipProps } from 'recharts'

import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import { cn } from '@/lib/utils'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_CHART_COLORS, statsChartAxisTick } from '../utils/statsChartTheme'
import { formatTimeseriesLabel } from '../utils/timeseriesFormat'
import { statsPeriodLabel, type StatsCustomRange, type StatsPeriod } from '../utils/statsPeriod'
import { StatsWidgetCard } from './StatsWidgetCard'

type ChartMetric = 'revenue' | 'sales' | 'new_users'

interface StatsMainChartProps {
  timeseries?: AdminStatsTimeSeriesDTO | null
  period: StatsPeriod
  customRange?: StatsCustomRange | null
  className?: string
}

interface ChartRow {
  name: string
  revenue: number
  sales: number
  new_users: number
}

const METRIC_COLOR: Record<ChartMetric, string> = {
  revenue: STATS_CHART_COLORS.pink,
  sales: STATS_CHART_COLORS.blue,
  new_users: STATS_CHART_COLORS.emerald,
}

/**
 * Главный график периода.
 *
 * Рисуется одна выбранная серия, а подсказка показывает все три числа за точку.
 * Две шкалы на одном графике (рубли слева, штуки справа) читаются неверно: их
 * пересечение выглядит событием, хотя зависит только от выбора масштаба.
 */
export function StatsMainChart({
  timeseries,
  period,
  customRange,
  className,
}: StatsMainChartProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const [metric, setMetric] = useState<ChartMetric>('revenue')

  const data = useMemo<ChartRow[]>(() => {
    if (!timeseries?.points?.length) return []
    return timeseries.points.map((p) => ({
      name: formatTimeseriesLabel(p.date, timeseries.granularity, numberLocale),
      revenue: p.revenue_rub,
      sales: p.sales,
      new_users: p.new_users,
    }))
  }, [timeseries, numberLocale])

  const metrics: { key: ChartMetric; label: string; icon: typeof Wallet }[] = [
    { key: 'revenue', label: t('admin.stats.chartMetricRevenue'), icon: Wallet },
    { key: 'sales', label: t('admin.stats.chartMetricSales'), icon: ShoppingCart },
    { key: 'new_users', label: t('admin.stats.chartMetricNew'), icon: UserPlus },
  ]

  const renderTooltip: TooltipProps<number, string>['content'] = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const row = payload[0].payload as ChartRow | undefined
    if (!row) return null
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
        <p className="mb-1 font-medium text-card-foreground">{label}</p>
        <ul className="space-y-0.5">
          <li className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: METRIC_COLOR.revenue }}
              />
              {t('admin.stats.chartMetricRevenue')}
            </span>
            <span className="font-medium tabular-nums text-card-foreground">
              {formatRub(row.revenue, numberLocale)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: METRIC_COLOR.sales }}
              />
              {t('admin.stats.chartMetricSales')}
            </span>
            <span className="font-medium tabular-nums text-card-foreground">
              {row.sales.toLocaleString(numberLocale)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: METRIC_COLOR.new_users }}
              />
              {t('admin.stats.chartMetricNew')}
            </span>
            <span className="font-medium tabular-nums text-card-foreground">
              {row.new_users.toLocaleString(numberLocale)}
            </span>
          </li>
        </ul>
      </div>
    )
  }

  const color = METRIC_COLOR[metric]

  return (
    <StatsWidgetCard
      icon={LineChartIcon}
      title={`${t('admin.stats.trend')} · ${statsPeriodLabel(t, period, { customRange, locale })}`}
      gradient="bg-gradient-to-r from-violet-500 to-indigo-500"
      accent="violet"
      className={className}
      headerExtra={
        <div className="flex shrink-0 gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
          {metrics.map((m) => {
            const MetricIcon = m.icon
            const active = m.key === metric
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                aria-pressed={active}
                title={m.label}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <MetricIcon
                  className="size-3.5 shrink-0"
                  style={active ? { color: METRIC_COLOR[m.key] } : undefined}
                />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            )
          })}
        </div>
      }
    >
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('admin.stats.chartEmpty')}
        </p>
      ) : (
        <div className="h-56 w-full sm:h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="statsMainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border) / 0.5)"
                vertical={false}
              />
              <XAxis dataKey="name" tick={statsChartAxisTick} axisLine={false} tickLine={false} />
              <YAxis
                tick={statsChartAxisTick}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                content={renderTooltip}
                cursor={{ stroke: 'hsl(var(--primary) / 0.5)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={color}
                fill="url(#statsMainGrad)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </StatsWidgetCard>
  )
}
