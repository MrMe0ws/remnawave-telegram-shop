import { useTranslation } from 'react-i18next'
import { Briefcase } from 'lucide-react'

import type { AdminPartnerProgramDTO } from '@/lib/types/admin'
import { cn } from '@/lib/utils'

import { formatAdminCustomerLabel } from '../../utils/formatAdminCustomerLabel'
import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { StatsPanel, StatsPanelHead } from './StatsPanel'

interface PartnerProgramBlockProps {
  data: AdminPartnerProgramDTO
  /** Всего клиентов в базе — чтобы показать, какую долю привели партнёры. */
  totalCustomers: number
  className?: string
}

/**
 * Партнёрская программа в разрезе «что с ней в целом».
 *
 * Экран /admin/partners отвечает про конкретного партнёра; статистике нужен
 * итог: сколько партнёров работает, кого они привели, сколько им начислено и
 * сколько из этого ещё лежит в холде.
 */
export function PartnerProgramBlock({
  data,
  totalCustomers,
  className,
}: PartnerProgramBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const conv = data.customers > 0 ? Math.round((data.paying_customers * 100) / data.customers) : 0
  const baseShare =
    totalCustomers > 0 ? Math.round((data.customers * 100) / totalCustomers) : 0

  const cells = [
    {
      label: t('admin.stats.partnerActive'),
      value: data.partners_active.toLocaleString(numberLocale),
      hint: t('admin.stats.partnerPending', { count: data.partners_pending }),
    },
    {
      label: t('admin.stats.partnerCustomers'),
      value: data.customers.toLocaleString(numberLocale),
      hint: t('admin.stats.partnerBaseShare', { pct: baseShare }),
    },
    {
      label: t('admin.stats.partnerPaying'),
      value: data.paying_customers.toLocaleString(numberLocale),
      hint: t('admin.stats.partnerConversion', { pct: conv }),
    },
    {
      label: t('admin.stats.partnerEarnedTotalLabel'),
      value: formatRub(data.earned_total, numberLocale),
      hint: t('admin.stats.partnerEarnedPeriodHint', {
        value: formatRub(data.earned_period, numberLocale),
      }),
    },
    {
      label: t('admin.stats.partnerPaidTotal'),
      value: formatRub(data.paid_total, numberLocale),
      hint: t('admin.stats.partnerOpenPayouts', { count: data.open_payouts }),
    },
    {
      label: t('admin.stats.partnerDue'),
      value: formatRub(data.available_balance, numberLocale),
      hint: t('admin.stats.partnerHoldHint', {
        value: formatRub(data.hold_balance, numberLocale),
      }),
      separated: true,
      accent: STATS_ACCENT.amber,
    },
  ]

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={Briefcase}
        color={STATS_ACCENT.blue}
        title={t('admin.stats.partnerTitle')}
        subtitle={t('admin.stats.partnerSubtitle')}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={cn(
              cell.separated && 'xl:border-l xl:border-border/50 xl:pl-4',
            )}
          >
            <div className="truncate text-xs text-muted-foreground">{cell.label}</div>
            <div
              className="mt-1 truncate text-xl font-semibold tabular-nums"
              style={cell.accent ? { color: cell.accent } : undefined}
            >
              {cell.value}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{cell.hint}</div>
          </div>
        ))}
      </div>

      {data.top.length > 0 && (
        <div className="mt-5 border-t border-border/50 pt-4">
          <p className="mb-3 text-[13px] text-muted-foreground">
            {t('admin.stats.partnerTopTitle')}
          </p>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="grid min-w-[22rem] grid-cols-[1.25rem_minmax(0,1fr)_5rem_5rem_6rem] items-center gap-x-3 gap-y-2.5">
              <div />
              <div className="text-xs text-muted-foreground">
                {t('admin.stats.partnerColPartner')}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {t('admin.stats.partnerColCustomers')}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {t('admin.stats.partnerColPaying')}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {t('admin.stats.partnerColEarned')}
              </div>

              {data.top.slice(0, 5).map((row, i) => (
                <PartnerRow
                  key={row.partner_id}
                  index={i + 1}
                  name={formatAdminCustomerLabel({
                    telegram_username: row.telegram_username,
                    nickname: row.nickname,
                    customer_id: row.customer_id,
                  })}
                  customers={row.customers.toLocaleString(numberLocale)}
                  paying={row.paying_customers.toLocaleString(numberLocale)}
                  earned={formatRub(row.earned, numberLocale)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </StatsPanel>
  )
}

function PartnerRow({
  index,
  name,
  customers,
  paying,
  earned,
}: {
  index: number
  name: string
  customers: string
  paying: string
  earned: string
}) {
  return (
    <>
      <div className="text-xs tabular-nums text-muted-foreground">{index}</div>
      <div className="truncate text-[13px]">{name}</div>
      <div className="text-right text-[13px] tabular-nums text-muted-foreground">{customers}</div>
      <div className="text-right text-[13px] font-semibold tabular-nums">{paying}</div>
      <div
        className="text-right text-[13px] tabular-nums"
        style={{ color: STATS_ACCENT.amber }}
      >
        {earned}
      </div>
    </>
  )
}
