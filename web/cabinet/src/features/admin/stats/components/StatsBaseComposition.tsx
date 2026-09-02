import { useTranslation } from 'react-i18next'
import { PieChart } from 'lucide-react'

import type { AdminStatsResponse } from '../../hooks/useAdminStats'

import { statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { StatsDot, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsBaseCompositionProps {
  data: AdminStatsResponse
  className?: string
}

/**
 * Состав базы одной полосой: кто платит сейчас, кто на пробном, кто ушёл после
 * оплаты и кто не платил ни разу. Четыре доли одного целого — поэтому одна
 * сложенная полоса, а не четыре отдельные карточки.
 */
export function StatsBaseComposition({ data, className }: StatsBaseCompositionProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const total = Math.max(data.total_customers, 1)
  const segments = [
    {
      label: t('admin.stats.compositionPaying'),
      value: data.paid_active,
      color: STATS_ACCENT.blue,
    },
    {
      label: t('admin.stats.compositionTrial'),
      value: data.trial_active,
      color: STATS_ACCENT.green,
    },
    {
      label: t('admin.stats.compositionChurned'),
      value: data.inactive_paid,
      color: STATS_ACCENT.orange,
    },
    {
      label: t('admin.stats.compositionNeverPaid'),
      value: data.inactive_unpaid,
      color: 'hsl(var(--muted-foreground) / 0.45)',
    },
  ]

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={PieChart}
        color={STATS_ACCENT.blue}
        title={t('admin.stats.compositionTitle')}
        subtitle={t('admin.stats.compositionSubtitle', {
          value: data.total_customers.toLocaleString(numberLocale),
        })}
      />

      <div className="mb-4 flex h-6 gap-0.5 overflow-hidden rounded-md">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{
              width: `${(segment.value * 100) / total}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2.5 text-[13px]">
            <StatsDot color={segment.color} />
            <span className="min-w-0 flex-1 truncate">{segment.label}</span>
            <span className="tabular-nums">{segment.value.toLocaleString(numberLocale)}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
              {Math.round((segment.value * 100) / total)}%
            </span>
          </div>
        ))}
      </div>
    </StatsPanel>
  )
}
