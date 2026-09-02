import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, RotateCcw, TrendingDown } from 'lucide-react'

import type { AdminFortuneStatsResponse } from '../../hooks/useAdminFortuneStats'
import { cn } from '@/lib/utils'

import { statsNumberLocale } from '../utils/statsFormat'
import { seriesColor, STATS_ACCENT } from '../utils/statsPalette'
import { fortunePeriodKey, type StatsPeriod } from '../utils/statsPeriod'
import { StatsBar, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsFortuneBlockProps {
  data: AdminFortuneStatsResponse
  period: StatsPeriod
  className?: string
}

/**
 * Экономика колеса: сколько дней собрали за крутки и сколько раздали призами.
 *
 * Главное число — разница. Колесо всегда выглядит выгодным по числу круток и
 * почти всегда убыточным по дням, и видно это только когда обе величины стоят
 * рядом.
 */
export function StatsFortuneBlock({ data, period, className }: StatsFortuneBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const slice = data[fortunePeriodKey(period)]
  const net = slice.paid_cost_days_sum - slice.won_subs_days_sum

  const cells = [
    {
      icon: RotateCcw,
      label: t('admin.stats.totalSpins'),
      value: slice.total_spins.toLocaleString(numberLocale),
      hint: t('admin.stats.fortuneSpinsSplit', {
        free: slice.free_spins.toLocaleString(numberLocale),
        paid: slice.paid_spins.toLocaleString(numberLocale),
      }),
    },
    {
      icon: ArrowDown,
      label: t('admin.stats.paidCostDays'),
      value: slice.paid_cost_days_sum.toLocaleString(numberLocale),
      hint: t('admin.stats.fortunePaidForSpins'),
    },
    {
      icon: ArrowUp,
      label: t('admin.stats.wonDays'),
      value: slice.won_subs_days_sum.toLocaleString(numberLocale),
      hint: t('admin.stats.fortuneWonSubs'),
    },
    {
      icon: TrendingDown,
      label: t('admin.stats.fortuneNet'),
      value: `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net).toLocaleString(numberLocale)}`,
      hint: t('admin.stats.fortuneNetHint'),
      separated: true,
      negative: net < 0,
    },
  ]

  const rewards = Object.entries(slice.by_reward)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
  const rewardsTotal = rewards.reduce((sum, r) => sum + r.count, 0)

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={RotateCcw}
        color={STATS_ACCENT.violet}
        title={t('admin.stats.fortune')}
        subtitle={t('admin.stats.fortuneSubtitle')}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 xl:grid-cols-4">
        {cells.map((cell) => {
          const CellIcon = cell.icon
          return (
            <div
              key={cell.label}
              className={cn(cell.separated && 'xl:border-l xl:border-border/50 xl:pl-4')}
            >
              <div className="flex items-center gap-2">
                <CellIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                  {cell.label}
                </span>
              </div>
              <div
                className={cn(
                  'mt-1 text-[22px] font-semibold tabular-nums',
                  cell.negative && 'text-rose-500',
                )}
              >
                {cell.value}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{cell.hint}</div>
            </div>
          )
        })}
      </div>

      {rewards.length > 0 && (
        <div className="mt-5 border-t border-border/50 pt-4">
          <p className="mb-3 text-[13px] text-muted-foreground">
            {t('admin.stats.fortuneRewardsSection')}
          </p>
          <div className="flex flex-col gap-3">
            {rewards.map((reward, i) => {
              const share = rewardsTotal > 0 ? (reward.count * 100) / rewardsTotal : 0
              return (
                <div key={reward.name} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">{reward.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t('admin.stats.fortuneRewardTimes', { count: reward.count })} ·{' '}
                      {Math.round(share)}%
                    </span>
                  </div>
                  <StatsBar percent={share} color={seriesColor(i)} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </StatsPanel>
  )
}
