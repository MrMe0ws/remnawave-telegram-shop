import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, RussianRuble, UserPlus, Users } from 'lucide-react'

import type { AdminStatsDTO } from '@/lib/types/admin'

import { formatAdminCustomerLabel } from '../../utils/formatAdminCustomerLabel'
import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
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
      />

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('admin.stats.referralsEmpty')}
        </p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-[24rem] grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_6rem_4rem] items-center gap-x-3 gap-y-2.5">
              <div />
              <div className="text-xs text-muted-foreground">{t('admin.stats.refColUser')}</div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5 shrink-0" aria-hidden />
                {t('admin.stats.refColPaid')}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <RussianRuble className="size-3.5 shrink-0" aria-hidden />
                {t('admin.stats.refColBrought')}
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {t('admin.stats.refColDays')}
              </div>

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
      <div className="truncate text-[13px]">{name}</div>
      <div className="text-right text-[13px] font-semibold tabular-nums">{paid}</div>
      <div className="text-right text-[13px] tabular-nums">{brought}</div>
      <div className="text-right text-[13px] tabular-nums text-muted-foreground">{days}</div>
    </>
  )
}
