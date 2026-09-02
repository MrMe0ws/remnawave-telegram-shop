import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'

import type { AdminLoyaltyStatsResponse } from '../../hooks/useAdminLoyaltyStats'

import { formatDecimal, statsNumberLocale } from '../utils/statsFormat'
import { seriesColor, STATS_ACCENT } from '../utils/statsPalette'
import { StatsBar, StatsFootnote, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsLoyaltyBlockProps {
  data: AdminLoyaltyStatsResponse
  className?: string
}

/** Уровни лояльности: сколько людей на каждом и какую скидку они дают. */
export function StatsLoyaltyBlock({ data, className }: StatsLoyaltyBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const total = data.tiers.reduce((sum, tier) => sum + tier.user_count, 0)

  // Средняя действующая скидка — взвешенная по числу людей на уровне: именно
  // она, а не максимальная, показывает, во что программа обходится.
  const weightedDiscount =
    total > 0
      ? data.tiers.reduce((sum, tier) => sum + tier.discount_percent * tier.user_count, 0) / total
      : 0

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={Star}
        color={STATS_ACCENT.amber}
        title={t('admin.stats.loyalty')}
        subtitle={t('admin.stats.loyaltySubtitle')}
      />

      {data.tiers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('admin.stats.loyaltyEmpty')}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {data.tiers.map((tier, i) => {
              const share = total > 0 ? (tier.user_count * 100) / total : 0
              // Всегда «Уровень N», без display_name: в него админ пишет
              // маркетинговое имя («Капитан»), и в сводке уровни перестают
              // читаться как шкала.
              const name = t('admin.stats.loyaltyLevelN', { n: tier.sort_order })
              return (
                <div key={tier.sort_order} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">
                      {name}
                      <span className="text-muted-foreground">
                        {' · '}
                        {t('admin.stats.loyaltyDiscountOf', { pct: tier.discount_percent })}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t('admin.stats.loyaltyPeople', {
                        count: tier.user_count,
                        value: tier.user_count.toLocaleString(numberLocale),
                      })}
                    </span>
                  </div>
                  <StatsBar percent={share} color={seriesColor(i)} />
                </div>
              )
            })}
          </div>

          <StatsFootnote>
            {t('admin.stats.loyaltyAvgDiscount', { pct: formatDecimal(weightedDiscount, numberLocale) })}
          </StatsFootnote>
        </>
      )}
    </StatsPanel>
  )
}
