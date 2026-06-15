import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import { buildGrowth, getStatsPeriodSlice, statsPeriodLabel, type StatsPeriod } from '../utils/statsPeriod'
import { statsNumberLocale } from '../utils/statsFormat'
import { buildSalesTrend } from '../utils/statsChartData'
import { formatTimeseriesLabel } from '../utils/timeseriesFormat'
import {
  STATS_CHART_COLORS,
  statsChartAxisTick,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

import { StatsWidgetCard } from './StatsWidgetCard'

interface SalesStatsWidgetProps {
  data: AdminStatsResponse
  period: StatsPeriod
  timeseries?: AdminStatsTimeSeriesDTO | null
  className?: string
}

export function SalesStatsWidget({ data, period, timeseries, className }: SalesStatsWidgetProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const slice = getStatsPeriodSlice(data, period)
  const periodLabel = statsPeriodLabel(t, period)
  const salesGrowth = buildGrowth(slice.sales, slice.salesPrev)

  const trend = useMemo(() => {
    if (timeseries?.points.length) {
      return timeseries.points.map((pt) => ({
        name: formatTimeseriesLabel(pt.date, timeseries.granularity, numberLocale),
        value: pt.sales,
      }))
    }
    return buildSalesTrend(data, t, period).map((pt) => ({ name: pt.label, value: pt.value }))
  }, [timeseries, data, period, t, numberLocale])

  return (
    <StatsWidgetCard
      icon={CreditCard}
      title={t('admin.stats.sales')}
      gradient="bg-gradient-to-r from-violet-500 to-purple-500"
      accent="purple"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t('admin.stats.salesPeriod', { period: periodLabel })}
            </p>
            <p className="text-2xl font-bold tabular-nums sm:text-3xl">
              {slice.sales.toLocaleString(numberLocale)}
              {salesGrowth && (
                <span
                  className={
                    salesGrowth.trend === 'up'
                      ? 'ml-1 text-xs font-medium text-emerald-500'
                      : salesGrowth.trend === 'down'
                        ? 'ml-1 text-xs font-medium text-rose-500'
                        : 'ml-1 text-xs font-medium text-muted-foreground'
                  }
                >
                  ({salesGrowth.pct})
                </span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t('admin.stats.transactionsPeriod', { period: periodLabel })}
            </p>
            <p className="text-2xl font-bold tabular-nums sm:text-3xl">
              {slice.transactions.toLocaleString(numberLocale)}
            </p>
          </div>
        </div>

        {trend.length > 0 ? (
          <div className="min-h-[120px] flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                <XAxis dataKey="name" tick={statsChartAxisTick} axisLine={false} tickLine={false} />
                <YAxis tick={statsChartAxisTick} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString(numberLocale)}
                  contentStyle={statsChartTooltipStyle}
                  labelStyle={statsChartTooltipLabelStyle}
                  itemStyle={statsChartTooltipItemStyle}
                />
                <Bar
                  dataKey="value"
                  name={t('admin.stats.sales')}
                  fill={STATS_CHART_COLORS.purple}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-auto text-xs text-muted-foreground">{t('admin.stats.salesTrendHint')}</p>
        )}
      </div>
    </StatsWidgetCard>
  )
}
