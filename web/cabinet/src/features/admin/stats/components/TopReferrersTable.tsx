import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarPlus, ChevronDown, ChevronUp, Trophy, User, Users, Wallet } from 'lucide-react'

import type { AdminStatsDTO } from '@/lib/types/admin'
import { cn } from '@/lib/utils'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { formatAdminCustomerLabel } from '../../utils/formatAdminCustomerLabel'
import { StatsWidgetCard } from './StatsWidgetCard'

interface TopReferrersTableProps {
  rows: AdminStatsDTO['top_referrers']
  className?: string
}

const COLLAPSED = 5
const EXPANDED = 10

/**
 * Топ пригласивших.
 *
 * Каждая колонка подписана иконкой и словом: раньше в последнем столбце стояло
 * голое число, и понять, приглашённые это, оплатившие или дни, было нельзя.
 */
export function TopReferrersTable({ rows, className }: TopReferrersTableProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const [expanded, setExpanded] = useState(false)

  if (rows.length === 0) return null

  const limit = expanded ? EXPANDED : COLLAPSED
  const visible = rows.slice(0, limit)
  const canExpand = rows.length > COLLAPSED

  return (
    <StatsWidgetCard
      icon={Trophy}
      title={t('admin.stats.topReferrers')}
      gradient="bg-gradient-to-r from-pink-500 to-rose-500"
      accent="pink"
      className={className}
    >
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="border-b border-border/50 text-xs text-muted-foreground">
              <th className="py-2 pr-2 text-left font-medium">
                <span className="flex items-center gap-1.5">
                  <User className="size-3.5 shrink-0" aria-hidden />
                  {t('admin.stats.refColUser')}
                </span>
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <span className="flex items-center justify-end gap-1.5">
                  <Users className="size-3.5 shrink-0" aria-hidden />
                  {t('admin.stats.refColInvited')}
                </span>
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <span className="flex items-center justify-end gap-1.5">
                  <Wallet className="size-3.5 shrink-0" aria-hidden />
                  {t('admin.stats.refColPaid')}
                </span>
              </th>
              <th className="py-2 px-2 text-right font-medium">
                <span className="flex items-center justify-end gap-1.5">
                  <Wallet className="size-3.5 shrink-0" aria-hidden />
                  {t('admin.stats.refColBrought')}
                </span>
              </th>
              <th className="py-2 pl-2 text-right font-medium">
                <span className="flex items-center justify-end gap-1.5">
                  <CalendarPlus className="size-3.5 shrink-0" aria-hidden />
                  {t('admin.stats.refColDays')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.referrer_id} className="border-b border-border/30 last:border-0">
                <td className="py-2 pr-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="truncate">
                      {formatAdminCustomerLabel({
                        telegram_username: row.telegram_username,
                        nickname: row.nickname,
                        customer_id: row.customer_id,
                      })}
                    </span>
                  </span>
                </td>
                <td className="px-2 text-right tabular-nums text-muted-foreground">
                  {row.referees.toLocaleString(numberLocale)}
                </td>
                <td className="px-2 text-right font-medium tabular-nums">
                  {row.paid_referees.toLocaleString(numberLocale)}
                </td>
                <td className="px-2 text-right tabular-nums">
                  {formatRub(row.revenue_rub, numberLocale)}
                </td>
                <td className="pl-2 text-right tabular-nums text-muted-foreground">
                  {row.bonus_days.toLocaleString(numberLocale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'mt-2 inline-flex min-h-10 items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline',
          )}
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded
            ? t('admin.stats.showTop', { count: COLLAPSED })
            : t('admin.stats.showTop', { count: Math.min(EXPANDED, rows.length) })}
        </button>
      )}
    </StatsWidgetCard>
  )
}
