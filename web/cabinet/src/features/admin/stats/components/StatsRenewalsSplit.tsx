import { useTranslation } from 'react-i18next'
import { RefreshCcw } from 'lucide-react'

import type { AdminStatsInsightsDTO } from '@/lib/types/admin'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { StatsDot, StatsFootnote, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsRenewalsSplitProps {
  renewals: AdminStatsInsightsDTO['renewals']
  className?: string
}

/**
 * Продления против первых покупок за период.
 *
 * Число, ради которого блок и существует, — доля продлений: пока она растёт,
 * выручка держится на уже приведённых клиентах, а не на закупке новых.
 */
export function StatsRenewalsSplit({ renewals, className }: StatsRenewalsSplitProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const total = renewals.first_count + renewals.renewal_count
  const renewalShare = total > 0 ? Math.round((renewals.renewal_count * 100) / total) : 0
  const firstShare = total > 0 ? 100 - renewalShare : 0

  const rows = [
    {
      label: t('admin.stats.renewalsRenewal'),
      color: STATS_ACCENT.green,
      sum: renewals.renewal_revenue,
      share: renewalShare,
    },
    {
      label: t('admin.stats.renewalsFirst'),
      color: STATS_ACCENT.blue,
      sum: renewals.first_revenue,
      share: firstShare,
    },
  ]

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={RefreshCcw}
        color={STATS_ACCENT.green}
        title={t('admin.stats.renewalsTitle')}
        subtitle={t('admin.stats.renewalsSubtitle')}
      />

      <div className="mb-4 flex h-6 gap-0.5 overflow-hidden">
        <div
          className="rounded-l-md"
          style={{ width: `${renewalShare}%`, backgroundColor: STATS_ACCENT.green }}
        />
        <div
          className="flex-1 rounded-r-md"
          style={{ backgroundColor: STATS_ACCENT.blue }}
        />
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2.5 text-[13px]">
            <StatsDot color={row.color} />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatRub(row.sum, numberLocale)}
            </span>
            <span className="w-11 shrink-0 text-right font-semibold tabular-nums">
              {row.share}%
            </span>
          </div>
        ))}
      </div>

      <StatsFootnote>{t('admin.stats.renewalsHint')}</StatsFootnote>
    </StatsPanel>
  )
}
