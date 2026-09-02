import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Hash, Ticket } from 'lucide-react'

import type { AdminPromoStatsResponse } from '../../hooks/useAdminPromoStats'
import { cn } from '@/lib/utils'

import { statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { StatsMore, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsPromosBlockProps {
  data: AdminPromoStatsResponse
  className?: string
}

const COLLAPSED = 5
const EXPANDED = 10

/** Промокоды: что активно и что реально гасят. */
export function StatsPromosBlock({ data, className }: StatsPromosBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const [expanded, setExpanded] = useState(false)

  const rows = data.top_by_redemptions
  const visible = rows.slice(0, expanded ? EXPANDED : COLLAPSED)
  const canExpand = rows.length > COLLAPSED

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={Ticket}
        color={STATS_ACCENT.green}
        title={t('admin.stats.promos')}
        subtitle={t('admin.stats.promosSubtitle', {
          active: data.active,
          total: data.total,
          redemptions: data.total_redemptions,
        })}
      />

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('admin.stats.promosEmpty')}
        </p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-[20rem] grid-cols-[minmax(0,1fr)_5.5rem_5rem_5rem] items-center gap-x-3 gap-y-2.5">
              <div className="text-xs text-muted-foreground">
                {t('admin.stats.promosColCode')}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('admin.stats.promosColStatus')}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <Hash className="size-3.5 shrink-0" aria-hidden />
                {t('admin.stats.promosColUsesShort')}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5 shrink-0" aria-hidden />
                {t('admin.stats.promosColRedemptionsShort')}
              </div>

              {visible.map((promo) => (
                <PromoRow
                  key={promo.id}
                  code={promo.code}
                  active={promo.active}
                  activeLabel={t(
                    promo.active
                      ? 'admin.stats.promosStatusActive'
                      : 'admin.stats.promosStatusInactive',
                  )}
                  uses={promo.uses_count.toLocaleString(numberLocale)}
                  redemptions={promo.redemptions.toLocaleString(numberLocale)}
                />
              ))}
            </div>
          </div>

          {canExpand && (
            <StatsMore
              expanded={expanded}
              onToggle={() => setExpanded((v) => !v)}
              label={t('admin.stats.showTop', {
                count: expanded ? COLLAPSED : Math.min(EXPANDED, rows.length),
              })}
            />
          )}
        </>
      )}
    </StatsPanel>
  )
}

function PromoRow({
  code,
  active,
  activeLabel,
  uses,
  redemptions,
}: {
  code: string
  active: boolean
  activeLabel: string
  uses: string
  redemptions: string
}) {
  return (
    <>
      <div className="truncate font-mono text-[13px] tracking-tight">{code}</div>
      <div>
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
            active
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {activeLabel}
        </span>
      </div>
      <div className="text-right text-[13px] tabular-nums text-muted-foreground">{uses}</div>
      <div className="text-right text-[13px] font-semibold tabular-nums">{redemptions}</div>
    </>
  )
}
