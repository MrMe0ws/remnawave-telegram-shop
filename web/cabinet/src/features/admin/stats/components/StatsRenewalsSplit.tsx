import { useTranslation } from 'react-i18next'
import { RefreshCcw, Sparkles, Repeat } from 'lucide-react'

import type { AdminStatsInsightsDTO } from '@/lib/types/admin'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_CHART_COLORS } from '../utils/statsChartTheme'
import { StatsWidgetCard } from './StatsWidgetCard'

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

  return (
    <StatsWidgetCard
      icon={RefreshCcw}
      title={t('admin.stats.renewalsTitle')}
      gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
      accent="emerald"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{t('admin.stats.renewalsShare')}</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{renewalShare}%</p>
        </div>

        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full"
            style={{ width: `${renewalShare}%`, backgroundColor: STATS_CHART_COLORS.emerald }}
          />
          <div className="h-full w-[2px] shrink-0 bg-card" />
          <div
            className="h-full flex-1"
            style={{ backgroundColor: STATS_CHART_COLORS.blue }}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Repeat className="size-3.5 shrink-0" style={{ color: STATS_CHART_COLORS.emerald }} />
              {t('admin.stats.renewalsRenewal')}
            </p>
            <p className="font-semibold tabular-nums">
              {renewals.renewal_count.toLocaleString(numberLocale)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {renewalShare}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatRub(renewals.renewal_revenue, numberLocale)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 shrink-0" style={{ color: STATS_CHART_COLORS.blue }} />
              {t('admin.stats.renewalsFirst')}
            </p>
            <p className="font-semibold tabular-nums">
              {renewals.first_count.toLocaleString(numberLocale)}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {firstShare}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatRub(renewals.first_revenue, numberLocale)}
            </p>
          </div>
        </div>
      </div>
    </StatsWidgetCard>
  )
}
