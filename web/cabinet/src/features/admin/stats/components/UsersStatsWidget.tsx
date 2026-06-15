import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import {
  activeSubsPct,
  buildGrowth,
  getStatsPeriodSlice,
  type StatsPeriod,
} from '../utils/statsPeriod'
import { statsNumberLocale } from '../utils/statsFormat'
import { buildNewUsersTrend } from '../utils/statsChartData'
import { formatTimeseriesLabel } from '../utils/timeseriesFormat'
import {
  STATS_CHART_COLORS,
  statsChartAxisTick,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

import { StatsChartLegend } from './StatsChartLegend'
import { StatsWidgetCard } from './StatsWidgetCard'

const VPN_COLORS = [STATS_CHART_COLORS.blue, STATS_CHART_COLORS.purple, STATS_CHART_COLORS.pink]

interface UsersStatsWidgetProps {
  data: AdminStatsResponse
  period: StatsPeriod
  timeseries?: AdminStatsTimeSeriesDTO | null
  className?: string
}

export function UsersStatsWidget({ data, period, timeseries, className }: UsersStatsWidgetProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const slice = getStatsPeriodSlice(data, period)

  const vpnDonut = useMemo(
    () => [
      { name: t('admin.stats.paidActive'), value: data.paid_active, color: VPN_COLORS[0] },
      { name: t('admin.stats.trialActive'), value: data.trial_active, color: VPN_COLORS[1] },
      { name: t('admin.stats.inactive'), value: data.inactive, color: VPN_COLORS[2] },
    ],
    [data.paid_active, data.trial_active, data.inactive, t],
  )

  const regTrend = useMemo(() => {
    if (timeseries?.points.length) {
      return timeseries.points.map((pt) => ({
        name: formatTimeseriesLabel(pt.date, timeseries.granularity, numberLocale),
        value: pt.new_users,
      }))
    }
    return buildNewUsersTrend(data, t, period).map((pt) => ({ name: pt.label, value: pt.value }))
  }, [timeseries, data, period, t, numberLocale])

  const regGrowth = buildGrowth(slice.newUsers, slice.newUsersPrev)
  const subsPct = activeSubsPct(data)
  const vpnTotal = data.paid_active + data.trial_active + data.inactive

  return (
    <StatsWidgetCard
      icon={Users}
      title={t('admin.stats.users')}
      gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
      accent="blue"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('admin.stats.totalCustomers')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.total_customers.toLocaleString(numberLocale)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('admin.stats.activeSubscriptions')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.active_subscriptions.toLocaleString(numberLocale)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({subsPct}%)</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-stretch">
          <div className="relative mx-auto h-36 w-full max-w-[160px] shrink-0 sm:mx-0 sm:h-36 sm:flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vpnDonut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {vpnDonut.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => value.toLocaleString(numberLocale)}
                  contentStyle={statsChartTooltipStyle}
                  labelStyle={statsChartTooltipLabelStyle}
                  itemStyle={statsChartTooltipItemStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{vpnTotal}</span>
              <span className="text-[10px] text-muted-foreground">{t('admin.stats.totalSubsStates')}</span>
            </div>
          </div>

          <div className="flex w-full flex-1 flex-col justify-center gap-2 sm:min-w-0">
            <StatsChartLegend
              items={vpnDonut.map((d) => ({
                label: d.name,
                color: d.color,
                value: d.value.toLocaleString(numberLocale),
              }))}
            />
            {period !== 'all_time' && (
              <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">
                  {t('admin.stats.newRegistrationsPeriod', {
                    period: t(`admin.stats.period.${period}`),
                  })}
                </p>
                <p className="font-semibold tabular-nums">
                  {slice.newUsers.toLocaleString(numberLocale)}
                  {regGrowth && (
                    <span
                      className={
                        regGrowth.trend === 'up'
                          ? 'ml-1 text-xs text-emerald-500'
                          : regGrowth.trend === 'down'
                            ? 'ml-1 text-xs text-rose-500'
                            : 'ml-1 text-xs text-muted-foreground'
                      }
                    >
                      ({regGrowth.pct})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {regTrend.length > 0 && (
          <div className="mt-auto h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={regTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="usersRegGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={STATS_CHART_COLORS.blue} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={STATS_CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={statsChartAxisTick} axisLine={false} tickLine={false} />
                <YAxis tick={statsChartAxisTick} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString(numberLocale)}
                  contentStyle={statsChartTooltipStyle}
                  labelStyle={statsChartTooltipLabelStyle}
                  itemStyle={statsChartTooltipItemStyle}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={t('admin.stats.newRegistrations')}
                  stroke={STATS_CHART_COLORS.blue}
                  fill="url(#usersRegGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </StatsWidgetCard>
  )
}
