import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart as LineChartIcon } from 'lucide-react'
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
import { STATS_ACCENT } from '../utils/statsPalette'
import { formatTimeseriesLabel } from '../utils/timeseriesFormat'
import { statsPeriodLabel, type StatsCustomRange, type StatsPeriod } from '../utils/statsPeriod'
import { StatsPanel, StatsPanelHead } from './StatsPanel'

type ChartMetric = 'revenue' | 'sales' | 'new_users'

interface StatsMainChartProps {
  timeseries?: AdminStatsTimeSeriesDTO | null
  period: StatsPeriod
  customRange?: StatsCustomRange | null
  /** Единственная серия без переключателя — для вкладки «Пользователи». */
  only?: ChartMetric
  title?: string
  className?: string
}

interface ChartRow {
  name: string
  revenue: number
  sales: number
  new_users: number
}

const METRIC_COLOR: Record<ChartMetric, string> = {
  revenue: STATS_ACCENT.cyan,
  sales: STATS_ACCENT.blue,
  new_users: STATS_ACCENT.green,
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
  only,
  title,
  className,
}: StatsMainChartProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const [picked, setPicked] = useState<ChartMetric>('revenue')
  const metric = only ?? picked

  const data = useMemo<ChartRow[]>(() => {
    if (!timeseries?.points?.length) return []
    return timeseries.points.map((p) => ({
      name: formatTimeseriesLabel(p.date, timeseries.granularity, numberLocale),
      revenue: p.revenue_rub,
      sales: p.sales,
      new_users: p.new_users,
    }))
  }, [timeseries, numberLocale])

  const metrics: { key: ChartMetric; label: string }[] = [
    { key: 'revenue', label: t('admin.stats.chartMetricRevenue') },
    { key: 'sales', label: t('admin.stats.chartMetricSales') },
    { key: 'new_users', label: t('admin.stats.chartMetricNew') },
  ]

  const renderTooltip: TooltipProps<number, string>['content'] = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const row = payload[0].payload as ChartRow | undefined
    if (!row) return null

    const lines: { key: ChartMetric; label: string; value: string }[] = [
      {
        key: 'revenue',
        label: t('admin.stats.chartMetricRevenue'),
        value: formatRub(row.revenue, numberLocale),
      },
      {
        key: 'sales',
        label: t('admin.stats.chartMetricSales'),
        value: row.sales.toLocaleString(numberLocale),
      },
      {
        key: 'new_users',
        label: t('admin.stats.chartMetricNew'),
        value: row.new_users.toLocaleString(numberLocale),
      },
    ]
    const shown = only ? lines.filter((l) => l.key === only) : lines

    return (
      <div className="cabinet-elevated-card min-w-[11rem] px-3 py-2.5 text-xs">
        <p className="font-semibold text-card-foreground">{label}</p>
        <ul className="mt-2 space-y-1.5">
          {shown.map((line) => (
            <li key={line.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: METRIC_COLOR[line.key] }}
                />
                {line.label}
              </span>
              <span className="font-semibold tabular-nums text-card-foreground">{line.value}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const color = METRIC_COLOR[metric]
  const heading =
    title ?? metrics.find((m) => m.key === metric)?.label ?? t('admin.stats.trend')

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={LineChartIcon}
        color={color}
        title={heading}
        subtitle={`${statsPeriodLabel(t, period, { customRange, locale })} · ${t('admin.stats.chartHoverHint')}`}
        actions={
          only ? undefined : (
            <div className="flex w-full shrink-0 gap-0.5 rounded-xl border border-border/60 bg-muted/30 p-0.5 sm:w-auto">
              {metrics.map((m) => {
                const active = m.key === metric
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPicked(m.key)}
                    aria-pressed={active}
                    className={cn(
                      'flex-1 rounded-[10px] px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3',
                      active
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>
          )
        }
      />

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('admin.stats.chartEmpty')}
        </p>
      ) : (
        <div className="h-52 w-full sm:h-60 lg:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 6, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id={`statsGrad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 5"
                stroke="hsl(var(--border) / 0.7)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                stroke="hsl(var(--border))"
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={46}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v))
                }
              />
              <Tooltip
                content={renderTooltip}
                cursor={{ stroke: color, strokeDasharray: '3 4', strokeWidth: 1, opacity: 0.6 }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={color}
                fill={`url(#statsGrad-${metric})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--card))', fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </StatsPanel>
  )
}
