import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, RotateCcw, RussianRuble, UserPlus, Users } from 'lucide-react'

import type { AdminStatsDTO } from '@/lib/types/admin'

import { formatAdminCustomerLabel } from '../../utils/formatAdminCustomerLabel'
import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { useResizableColumns, type ResizableColumn } from '../utils/useResizableColumns'
import { StatsHeaderCell } from './StatsColumnHandle'
import { StatsMore, StatsPanel, StatsPanelHead } from './StatsPanel'

interface TopReferrersTableProps {
  rows: AdminStatsDTO['top_referrers']
  distinctReferrers: number
  activeReferrers: number
  bonusDaysAll: number
  className?: string
}

const COLLAPSED = 5
const EXPANDED = 10

/** Ники бывают и короткие, и в тридцать символов — ширины двигаются руками. */
const COLUMNS: ResizableColumn[] = [
  { key: 'index', width: 20, min: 16 },
  { key: 'user', width: 140, min: 40 },
  { key: 'paid', width: 72, min: 32 },
  { key: 'brought', width: 96, min: 40 },
  { key: 'days', width: 64, min: 32, flex: true },
]

/**
 * Топ пригласивших.
 *
 * У каждой колонки значок и слово: раньше в последнем столбце стояло голое
 * число, и понять, приглашённые это, оплатившие или дни, было нельзя.
 */
export function TopReferrersTable({
  rows,
  distinctReferrers,
  activeReferrers,
  bonusDaysAll,
  className,
}: TopReferrersTableProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const [expanded, setExpanded] = useState(false)
  const cols = useResizableColumns('referrers', COLUMNS)

  const visible = rows.slice(0, expanded ? EXPANDED : COLLAPSED)
  const canExpand = rows.length > COLLAPSED

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={UserPlus}
        color={STATS_ACCENT.amber}
        title={t('admin.stats.referrals')}
        subtitle={t('admin.stats.referralsSubtitle', {
          referrers: distinctReferrers.toLocaleString(numberLocale),
          active: activeReferrers.toLocaleString(numberLocale),
          days: bonusDaysAll.toLocaleString(numberLocale),
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
          {t('admin.stats.referralsEmpty')}
        </p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <div
              className="grid items-center gap-x-3 gap-y-2.5"
              style={{ gridTemplateColumns: cols.template }}
            >
              <StatsHeaderCell columnKey="index" cols={cols} />
              <StatsHeaderCell columnKey="user" cols={cols}>
                {t('admin.stats.refColUser')}
              </StatsHeaderCell>
              <StatsHeaderCell columnKey="paid" cols={cols} icon={Users} align="right">
                {t('admin.stats.refColPaid')}
              </StatsHeaderCell>
              <StatsHeaderCell columnKey="brought" cols={cols} icon={RussianRuble} align="right">
                {t('admin.stats.refColBrought')}
              </StatsHeaderCell>
              <StatsHeaderCell columnKey="days" cols={cols} icon={CalendarDays} align="right" last>
                {t('admin.stats.refColDays')}
              </StatsHeaderCell>

              {visible.map((row, i) => (
                <Row
                  key={row.referrer_id}
                  index={i + 1}
                  name={formatAdminCustomerLabel({
                    telegram_username: row.telegram_username,
                    nickname: row.nickname,
                    customer_id: row.customer_id,
                  })}
                  paid={row.paid_referees.toLocaleString(numberLocale)}
                  brought={formatRub(row.revenue_rub, numberLocale)}
                  days={row.bonus_days.toLocaleString(numberLocale)}
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

function Row({
  index,
  name,
  paid,
  brought,
  days,
}: {
  index: number
  name: string
  paid: string
  brought: string
  days: string
}) {
  return (
    <>
      <div className="text-xs tabular-nums text-muted-foreground">{index}</div>
      <div className="truncate text-[13px]" title={name}>
        {name}
      </div>
      <div className="truncate text-right text-[13px] font-semibold tabular-nums">{paid}</div>
      <div className="truncate text-right text-[13px] tabular-nums">{brought}</div>
      <div className="truncate text-right text-[13px] tabular-nums text-muted-foreground">
        {days}
      </div>
    </>
  )
}
