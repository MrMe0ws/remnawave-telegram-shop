import { useTranslation } from 'react-i18next'
import { Filter } from 'lucide-react'

import type { AdminStatsInsightsDTO } from '@/lib/types/admin'

import { statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { StatsBar, StatsFootnote, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsFunnelBlockProps {
  funnel: AdminStatsInsightsDTO['funnel']
  className?: string
}

/**
 * Воронка «регистрация → счёт → оплата».
 *
 * Шага «зашёл на сайт» здесь нет и не будет, пока визиты не начнут писаться:
 * рисовать первый шаг «на глаз» — значит выдумывать конверсию.
 */
export function StatsFunnelBlock({ funnel, className }: StatsFunnelBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const steps = [
    { label: t('admin.stats.funnelRegistered'), value: funnel.registered, color: STATS_ACCENT.blue },
    { label: t('admin.stats.funnelInvoiced'), value: funnel.invoiced, color: STATS_ACCENT.green },
    { label: t('admin.stats.funnelPaid'), value: funnel.paid, color: STATS_ACCENT.amber },
  ]
  const base = Math.max(funnel.registered, 1)

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={Filter}
        color={STATS_ACCENT.violet}
        title={t('admin.stats.funnelTitle')}
        subtitle={t('admin.stats.funnelSubtitle')}
      />

      <div className="flex flex-col gap-3.5">
        {steps.map((step, i) => {
          const prev = i === 0 ? null : steps[i - 1].value
          const conv = prev && prev > 0 ? Math.round((step.value * 100) / prev) : null
          return (
            <div key={step.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate">{step.label}</span>
                <span className="shrink-0">
                  <span className="font-semibold tabular-nums">
                    {step.value.toLocaleString(numberLocale)}
                  </span>
                  {conv !== null && (
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {t('admin.stats.funnelOfPrev', { pct: conv })}
                    </span>
                  )}
                </span>
              </div>
              <StatsBar percent={(step.value * 100) / base} color={step.color} />
            </div>
          )
        })}
      </div>

      <StatsFootnote>{t('admin.stats.funnelCohortHint')}</StatsFootnote>
    </StatsPanel>
  )
}
