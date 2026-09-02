import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Check, Gift, Hash, RotateCcw, Ticket } from 'lucide-react'

import type {
  AdminPromoStatsResponse,
  AdminPromoStatsTopItem,
} from '../../hooks/useAdminPromoStats'
import { cn } from '@/lib/utils'

import { statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { useResizableColumns, type ResizableColumn } from '../utils/useResizableColumns'
import { StatsColumnHandle } from './StatsColumnHandle'
import { StatsMore, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsPromosBlockProps {
  data: AdminPromoStatsResponse
  className?: string
}

const COLLAPSED = 5
const EXPANDED = 10

/**
 * Ширины по умолчанию рассчитаны на короткий код. Длинные коды админ раздвинет
 * сам — ручкой между заголовками, выбор запомнится.
 */
const COLUMNS: ResizableColumn[] = [
  { key: 'code', width: 104, min: 56 },
  { key: 'gives', width: 132, min: 72 },
  { key: 'status', width: 92, min: 64 },
  { key: 'uses', width: 64, min: 48 },
  { key: 'redemptions', width: 64, min: 48, flex: true },
]

/**
 * Что код даёт, одной строкой.
 *
 * Тип и величина живут в разных колонках таблицы promo_code, поэтому подпись
 * собирается здесь: «+30 дней», «скидка 15%», «+2 устройств». Без неё в сводке
 * стоял голый код, и понять, за что его гасят, было нельзя.
 */
function promoReward(promo: AdminPromoStatsTopItem, t: TFunction): string {
  switch (promo.type) {
    case 'subscription_days':
      return promo.subscription_days
        ? t('admin.stats.promoGivesDays', { count: promo.subscription_days })
        : t('admin.stats.promoGivesSubscription')
    case 'trial':
      return promo.trial_days
        ? t('admin.stats.promoGivesTrial', { count: promo.trial_days })
        : t('admin.stats.promoGivesTrialPlain')
    case 'extra_hwid':
      return promo.extra_hwid_delta
        ? t('admin.stats.promoGivesDevices', { count: promo.extra_hwid_delta })
        : t('admin.stats.promoGivesDevicesPlain')
    case 'discount':
      return promo.discount_percent
        ? t('admin.stats.promoGivesDiscount', { pct: promo.discount_percent })
        : t('admin.stats.promoGivesDiscountPlain')
    default:
      return promo.type || '—'
  }
}

/** Промокоды: что активно, что они дают и что реально гасят. */
export function StatsPromosBlock({ data, className }: StatsPromosBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const [expanded, setExpanded] = useState(false)
  const cols = useResizableColumns('promos', COLUMNS)

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
        actions={
          cols.customized ? (
            <button
              type="button"
              onClick={cols.resetAll}
              title={t('admin.stats.columnResetAll')}
              aria-label={t('admin.stats.columnResetAll')}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
            </button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('admin.stats.promosEmpty')}
        </p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <div
              className="grid items-center gap-x-3 gap-y-2.5"
              style={{ gridTemplateColumns: cols.template }}
            >
              <HeaderCell columnKey="code" cols={cols}>
                {t('admin.stats.promosColCode')}
              </HeaderCell>
              <HeaderCell columnKey="gives" cols={cols} icon={Gift}>
                {t('admin.stats.promosColGives')}
              </HeaderCell>
              <HeaderCell columnKey="status" cols={cols}>
                {t('admin.stats.promosColStatus')}
              </HeaderCell>
              <HeaderCell columnKey="uses" cols={cols} icon={Hash} align="right">
                {t('admin.stats.promosColUsesShort')}
              </HeaderCell>
              <HeaderCell columnKey="redemptions" cols={cols} icon={Check} align="right" last>
                {t('admin.stats.promosColRedemptionsShort')}
              </HeaderCell>

              {visible.map((promo) => (
                <PromoRow
                  key={promo.id}
                  code={promo.code}
                  gives={promoReward(promo, t)}
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

function HeaderCell({
  columnKey,
  cols,
  icon: Icon,
  align = 'left',
  last,
  children,
}: {
  columnKey: string
  cols: ReturnType<typeof useResizableColumns>
  icon?: typeof Gift
  align?: 'left' | 'right'
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative min-w-0">
      <span
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground',
          align === 'right' && 'justify-end',
        )}
      >
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{children}</span>
      </span>
      {!last && (
        <StatsColumnHandle
          columnKey={columnKey}
          onResize={cols.startResize}
          onReset={cols.resetColumn}
        />
      )}
    </div>
  )
}

function PromoRow({
  code,
  gives,
  active,
  activeLabel,
  uses,
  redemptions,
}: {
  code: string
  gives: string
  active: boolean
  activeLabel: string
  uses: string
  redemptions: string
}) {
  return (
    <>
      <div className="truncate font-mono text-[13px] tracking-tight" title={code}>
        {code}
      </div>
      <div className="truncate text-xs text-muted-foreground" title={gives}>
        {gives}
      </div>
      <div className="min-w-0">
        <span
          className={cn(
            'inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium',
            active
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {activeLabel}
        </span>
      </div>
      <div className="truncate text-right text-[13px] tabular-nums text-muted-foreground">
        {uses}
      </div>
      <div className="truncate text-right text-[13px] font-semibold tabular-nums">
        {redemptions}
      </div>
    </>
  )
}
