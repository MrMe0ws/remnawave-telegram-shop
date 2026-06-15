import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Wallet } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import { formatPeriodRub, getStatsPeriodSlice, statsPeriodLabel, type StatsPeriod } from '../utils/statsPeriod'
import { statsNumberLocale } from '../utils/statsFormat'
import { buildRevenueTrend } from '../utils/statsChartData'
import { formatTimeseriesLabel } from '../utils/timeseriesFormat'
import {
  STATS_CHART_COLORS,
  statsChartAxisTick,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

import { StatsWidgetCard } from './StatsWidgetCard'

interface RevenueStatsWidgetProps {
  data: AdminStatsResponse
  period: StatsPeriod
  timeseries?: AdminStatsTimeSeriesDTO | null
  className?: string
}

export function RevenueStatsWidget({ data, period, timeseries, className }: RevenueStatsWidgetProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const slice = getStatsPeriodSlice(data, period)
  const periodLabel = statsPeriodLabel(t, period)

  const trend = useMemo(() => {
    if (timeseries?.points.length) {
      return timeseries.points.map((pt) => ({
        name: formatTimeseriesLabel(pt.date, timeseries.granularity, numberLocale),
        value: pt.revenue_rub,
      }))
    }
    return buildRevenueTrend(data, t, period).map((pt) => ({
      name: pt.label,
      value: pt.value,
    }))
  }, [timeseries, data, period, t, numberLocale])

  return (
    <StatsWidgetCard
      icon={Wallet}
      title={t('admin.stats.revenue')}
      gradient="bg-gradient-to-r from-violet-500 to-indigo-500"
      accent="violet"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {t('admin.stats.revenuePeriod', { period: periodLabel })}
          </p>
          <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
            {formatPeriodRub(slice.revenue, numberLocale)}
          </p>
        </div>

        <div className="h-28 w-full sm:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STATS_CHART_COLORS.pink} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={STATS_CHART_COLORS.pink} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={statsChartAxisTick} axisLine={false} tickLine={false} />
              <YAxis
                tick={statsChartAxisTick}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <Tooltip
                formatter={(value: number) => formatPeriodRub(value, numberLocale)}
                contentStyle={statsChartTooltipStyle}
                labelStyle={statsChartTooltipLabelStyle}
                itemStyle={statsChartTooltipItemStyle}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={t('admin.stats.revenue')}
                stroke={STATS_CHART_COLORS.pink}
                fill="url(#revenueGrad)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: STATS_CHART_COLORS.pink, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t('admin.stats.uniquePayersPeriod', { period: periodLabel })}
            </p>
            <p className="font-semibold tabular-nums">{slice.uniquePayers.toLocaleString(numberLocale)}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {slice.uniquePayers > 0 && period !== 'all_time'
                ? t('admin.stats.arpuPeriod', { period: periodLabel })
                : t('admin.stats.transactionsPeriod', { period: periodLabel })}
            </p>
            <p className="font-semibold tabular-nums">
              {slice.uniquePayers > 0 && period !== 'all_time'
                ? formatPeriodRub(slice.revenue / slice.uniquePayers, numberLocale)
                : slice.transactions.toLocaleString(numberLocale)}
            </p>
          </div>
        </div>
      </div>
    </StatsWidgetCard>
  )
}
