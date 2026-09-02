import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Gift,
  Percent,
  RotateCcw,
  Scale,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import type { AdminFortuneStatsResponse } from '../../hooks/useAdminFortuneStats'
import { cn } from '@/lib/utils'

import { statsNumberLocale } from '../utils/statsFormat'
import { seriesColor, STATS_ACCENT } from '../utils/statsPalette'
import { fortunePeriodKey, type StatsPeriod } from '../utils/statsPeriod'
import { StatsBar, StatsIconChip, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsFortuneBlockProps {
  data: AdminFortuneStatsResponse
  period: StatsPeriod
  className?: string
}

/** Значок награды по её идентификатору: дни, опыт или скидка. */
const REWARD_ICONS: { test: RegExp; icon: LucideIcon }[] = [
  { test: /day|дн/i, icon: CalendarDays },
  { test: /xp|micro|лоял/i, icon: Sparkles },
  { test: /discount|скид/i, icon: Percent },
]

function rewardIcon(name: string): LucideIcon {
  return REWARD_ICONS.find((r) => r.test.test(name))?.icon ?? Gift
}

/**
 * Экономика колеса: сколько дней собрали за крутки и сколько раздали призами.
 *
 * Цвет здесь означает сторону сделки: зелёное — пришло магазину, красное —
 * ушло от него, обычный тон — нейтральный счётчик. Главное число, ради
 * которого блок и существует, — разница: колесо всегда выглядит выгодным по
 * числу круток и почти всегда убыточным по дням, и видно это только когда обе
 * величины стоят рядом.
 */
export function StatsFortuneBlock({ data, period, className }: StatsFortuneBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const slice = data[fortunePeriodKey(period)]
  const net = slice.paid_cost_days_sum - slice.won_subs_days_sum

  const cells: {
    icon: LucideIcon
    label: string
    value: string
    hint: string
    tone: 'good' | 'bad' | 'neutral'
    separated?: boolean
  }[] = [
    {
      icon: RotateCcw,
      label: t('admin.stats.totalSpins'),
      value: slice.total_spins.toLocaleString(numberLocale),
      hint: t('admin.stats.fortuneSpinsSplit', {
        free: slice.free_spins.toLocaleString(numberLocale),
        paid: slice.paid_spins.toLocaleString(numberLocale),
      }),
      tone: 'neutral',
    },
    {
      icon: ArrowDown,
      label: t('admin.stats.paidCostDays'),
      value: slice.paid_cost_days_sum.toLocaleString(numberLocale),
      hint: t('admin.stats.fortunePaidForSpins'),
      tone: 'good',
    },
    {
      icon: ArrowUp,
      label: t('admin.stats.wonDays'),
      value: slice.won_subs_days_sum.toLocaleString(numberLocale),
      hint: t('admin.stats.fortuneWonSubs'),
      tone: 'bad',
    },
    {
      icon: Scale,
      label: t('admin.stats.fortuneNet'),
      value: `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net).toLocaleString(numberLocale)}`,
      hint: net < 0 ? t('admin.stats.fortuneNetLoss') : t('admin.stats.fortuneNetGain'),
      tone: net < 0 ? 'bad' : net > 0 ? 'good' : 'neutral',
      separated: true,
    },
  ]

  const rewards = Object.entries(slice.by_reward)
    .map(([name, count]) => ({ name, count }))
    .filter((r) => r.count > 0)
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
                <CellIcon
                  className={cn(
                    'size-3.5 shrink-0',
                    cell.tone === 'good' && 'text-emerald-500',
                    cell.tone === 'bad' && 'text-rose-500',
                    cell.tone === 'neutral' && 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                  {cell.label}
                </span>
              </div>
              <div
                className={cn(
                  'mt-1 text-[22px] font-semibold tabular-nums',
                  cell.tone === 'good' && 'text-emerald-500',
                  cell.tone === 'bad' && 'text-rose-500',
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
              const color = seriesColor(i)
              return (
                <div key={reward.name} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <StatsIconChip icon={rewardIcon(reward.name)} color={color} size="sm" />
                      <span className="truncate">{reward.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t('admin.stats.fortuneRewardTimes', { count: reward.count })} ·{' '}
                      {Math.round(share)}%
                    </span>
                  </div>
                  <StatsBar percent={share} color={color} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </StatsPanel>
  )
}
