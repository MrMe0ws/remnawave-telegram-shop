import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2 } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import { getStatsPeriodSlice, statsPeriodLabel, type StatsPeriod } from '../utils/statsPeriod'
import { statsNumberLocale } from '../utils/statsFormat'
import { buildReferralTrend } from '../utils/statsChartData'
import {
  STATS_CHART_PALETTE,
  statsChartAxisTick,
  statsChartTooltipItemStyle,
  statsChartTooltipLabelStyle,
  statsChartTooltipStyle,
} from '../utils/statsChartTheme'

import { StatsWidgetCard } from './StatsWidgetCard'
import { formatAdminCustomerLabel } from '../../utils/formatAdminCustomerLabel'

interface ReferralsStatsWidgetProps {
  data: AdminStatsResponse
  period: StatsPeriod
  className?: string
}

export function ReferralsStatsWidget({ data, period, className }: ReferralsStatsWidgetProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const slice = getStatsPeriodSlice(data, period)
  const periodLabel = statsPeriodLabel(t, period)

  const barData = useMemo(
    () => buildReferralTrend(data, t, period).map((pt) => ({ name: pt.label, value: pt.value })),
    [data, period, t],
  )

  return (
    <StatsWidgetCard
      icon={Link2}
      title={t('admin.stats.referrals')}
      gradient="bg-gradient-to-r from-pink-500 to-rose-500"
      accent="pink"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('admin.stats.distinctReferrers')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.distinct_referrers.toLocaleString(numberLocale)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t('admin.stats.activeReferrers')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {data.active_referrers.toLocaleString(numberLocale)}
            </p>
          </div>
        </div>

        <div className="min-h-[140px] flex-1 w-full">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {t('admin.stats.referralBonusTrend')}
          </p>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={barData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={statsChartAxisTick}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-12}
                textAnchor="end"
                height={42}
              />
              <YAxis tick={statsChartAxisTick} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(value: number) => value.toLocaleString(numberLocale)}
                contentStyle={statsChartTooltipStyle}
                labelStyle={statsChartTooltipLabelStyle}
                itemStyle={statsChartTooltipItemStyle}
              />
              <Bar dataKey="value" name={t('admin.stats.bonusDaysAll')} radius={[6, 6, 0, 0]} maxBarSize={48}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={STATS_CHART_PALETTE[i % STATS_CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">
            {t('admin.stats.bonusDaysPeriod', { period: periodLabel })}
          </p>
          <p className="font-semibold tabular-nums text-rose-400">
            {slice.refBonus.toLocaleString(numberLocale)}
          </p>
        </div>

        {data.top_referrers.length > 0 && (
          <div className="border-t border-border/50 pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t('admin.stats.topReferrers')}
            </p>
            <ul className="space-y-1 text-xs">
              {data.top_referrers.slice(0, 3).map((r, i) => (
                <li key={r.referrer_id} className="flex justify-between gap-2 tabular-nums">
                  <span className="truncate text-muted-foreground">
                    #{i + 1}{' '}
                    {formatAdminCustomerLabel({
                      telegram_username: r.telegram_username,
                      nickname: r.nickname,
                      customer_id: r.customer_id,
                    })}
                  </span>
                  <span className="shrink-0 font-medium">
                    {r.paid_referees} {t('admin.stats.paidRefs')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </StatsWidgetCard>
  )
}
