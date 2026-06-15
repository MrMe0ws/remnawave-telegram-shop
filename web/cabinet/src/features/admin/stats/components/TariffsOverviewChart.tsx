import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import {
  formatPeriodRub,
  statsPeriodLabel,
  tariffPeriodRevenue,
  tariffPeriodSales,
  type StatsPeriod,
} from '../utils/statsPeriod'
import { statsNumberLocale } from '../utils/statsFormat'
import {
  STATS_CHART_COLORS,
  STATS_CHART_PALETTE,
  statsChartAxisTick,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

import { StatsWidgetCard } from './StatsWidgetCard'

interface TariffsOverviewChartProps {
  rows: AdminStatsResponse['tariff_breakdown']
  period: StatsPeriod
  className?: string
}

export function TariffsOverviewChart({ rows, period, className }: TariffsOverviewChartProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const periodLabel = statsPeriodLabel(t, period)

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        name: row.display_name,
        sales: tariffPeriodSales(row, period),
        revenue: tariffPeriodRevenue(row, period),
      })),
    [rows, period],
  )

  if (rows.length === 0) return null

  return (
    <StatsWidgetCard
      icon={Layers}
      title={`${t('admin.stats.tariffBreakdown')} · ${periodLabel}`}
      gradient="bg-gradient-to-r from-teal-500 to-emerald-500"
      accent="emerald"
      className={className}
    >
      <div className="h-56 w-full sm:h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="tariffSalesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STATS_CHART_COLORS.blue} stopOpacity={0.35} />
                <stop offset="100%" stopColor={STATS_CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="tariffRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STATS_CHART_COLORS.pink} stopOpacity={0.35} />
                <stop offset="100%" stopColor={STATS_CHART_COLORS.pink} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={statsChartAxisTick}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={rows.length > 4 ? -18 : 0}
              textAnchor={rows.length > 4 ? 'end' : 'middle'}
              height={rows.length > 4 ? 48 : 24}
            />
            <YAxis
              yAxisId="sales"
              tick={statsChartAxisTick}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tick={statsChartAxisTick}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              contentStyle={statsChartTooltipStyle}
              labelStyle={statsChartTooltipLabelStyle}
              itemStyle={statsChartTooltipItemStyle}
              formatter={(value: number, name: string) => {
                if (name === t('admin.stats.revenue')) {
                  return formatPeriodRub(value, numberLocale)
                }
                return value.toLocaleString(numberLocale)
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              formatter={(value) => (
                <span className="text-muted-foreground">{value}</span>
              )}
            />
            <Area
              yAxisId="sales"
              type="monotone"
              dataKey="sales"
              name={t('admin.stats.sales')}
              stroke={STATS_CHART_COLORS.blue}
              fill="url(#tariffSalesGrad)"
              strokeWidth={2}
            />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              name={t('admin.stats.revenue')}
              stroke={STATS_CHART_COLORS.pink}
              fill="url(#tariffRevenueGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {rows.length <= 6 && (
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {rows.map((row, i) => (
            <div
              key={row.tariff_id}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/20 px-2.5 py-1 text-xs"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: STATS_CHART_PALETTE[i % STATS_CHART_PALETTE.length] }}
              />
              <span className="font-medium">{row.display_name}</span>
              <span className="text-muted-foreground">
                {tariffPeriodSales(row, period)} / {formatPeriodRub(tariffPeriodRevenue(row, period), numberLocale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </StatsWidgetCard>
  )
}
