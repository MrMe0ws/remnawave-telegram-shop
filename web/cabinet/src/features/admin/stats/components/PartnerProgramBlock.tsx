import { useTranslation } from 'react-i18next'
import {
  Banknote,
  Clock,
  Handshake,
  Percent,
  Send,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'

import type { AdminPartnerProgramDTO } from '@/lib/types/admin'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { formatAdminCustomerLabel } from '../../utils/formatAdminCustomerLabel'
import { StatsWidgetCard } from './StatsWidgetCard'

interface PartnerProgramBlockProps {
  data: AdminPartnerProgramDTO
  className?: string
}

/**
 * Партнёрская программа в разрезе «что с ней в целом».
 *
 * Экран /admin/partners отвечает про конкретного партнёра; статистике нужен
 * итог: сколько партнёров работает, кого они привели, сколько им начислено и
 * сколько из этого ещё лежит в холде.
 */
export function PartnerProgramBlock({ data, className }: PartnerProgramBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const conv =
    data.customers > 0 ? Math.round((data.paying_customers * 100) / data.customers) : 0

  const tiles = [
    {
      icon: Handshake,
      label: t('admin.stats.partnerActive'),
      value: data.partners_active.toLocaleString(numberLocale),
      hint: t('admin.stats.partnerPending', { count: data.partners_pending }),
    },
    {
      icon: Users,
      label: t('admin.stats.partnerCustomers'),
      value: data.customers.toLocaleString(numberLocale),
      hint: t('admin.stats.partnerActiveCustomers', { count: data.active_customers }),
    },
    {
      icon: UserCheck,
      label: t('admin.stats.partnerPaying'),
      value: data.paying_customers.toLocaleString(numberLocale),
      hint: t('admin.stats.partnerConversion', { pct: conv }),
    },
    {
      icon: Banknote,
      label: t('admin.stats.partnerEarnedPeriod'),
      value: formatRub(data.earned_period, numberLocale),
      hint: t('admin.stats.partnerEarnedTotal', {
        value: formatRub(data.earned_total, numberLocale),
      }),
    },
    {
      icon: Wallet,
      label: t('admin.stats.partnerPaidTotal'),
      value: formatRub(data.paid_total, numberLocale),
      hint: t('admin.stats.partnerAvailable', {
        value: formatRub(data.available_balance, numberLocale),
      }),
    },
    {
      icon: Clock,
      label: t('admin.stats.partnerHold'),
      value: formatRub(data.hold_balance, numberLocale),
      hint: t('admin.stats.partnerOpenPayouts', {
        count: data.open_payouts,
        value: formatRub(data.open_payouts_amount, numberLocale),
      }),
    },
  ]

  return (
    <StatsWidgetCard
      icon={Handshake}
      title={t('admin.stats.partnerTitle')}
      gradient="bg-gradient-to-r from-amber-500 to-orange-500"
      accent="fuchsia"
      className={className}
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => {
            const TileIcon = tile.icon
            return (
              <div
                key={tile.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 sm:block"
              >
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <TileIcon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{tile.label}</span>
                </p>
                <div className="shrink-0 text-right sm:mt-1 sm:text-left">
                  <p className="text-lg font-semibold tabular-nums">{tile.value}</p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {tile.hint}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {data.top.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {t('admin.stats.partnerTopTitle')}
            </p>
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  <th className="py-2 pr-2 text-left font-medium">
                    <span className="flex items-center gap-1.5">
                      <Handshake className="size-3.5 shrink-0" aria-hidden />
                      {t('admin.stats.partnerColPartner')}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    <span className="flex items-center justify-end gap-1.5">
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      {t('admin.stats.partnerColCustomers')}
                    </span>
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    <span className="flex items-center justify-end gap-1.5">
                      <Percent className="size-3.5 shrink-0" aria-hidden />
                      {t('admin.stats.partnerColPaying')}
                    </span>
                  </th>
                  <th className="py-2 pl-2 text-right font-medium">
                    <span className="flex items-center justify-end gap-1.5">
                      <Banknote className="size-3.5 shrink-0" aria-hidden />
                      {t('admin.stats.partnerColEarned')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.top.slice(0, 5).map((row) => (
                  <tr key={row.partner_id} className="border-b border-border/30 last:border-0">
                    <td className="truncate py-2 pr-2">
                      {formatAdminCustomerLabel({
                        telegram_username: row.telegram_username,
                        nickname: row.nickname,
                        customer_id: row.customer_id,
                      })}
                    </td>
                    <td className="px-2 text-right tabular-nums text-muted-foreground">
                      {row.customers.toLocaleString(numberLocale)}
                    </td>
                    <td className="px-2 text-right font-medium tabular-nums">
                      {row.paying_customers.toLocaleString(numberLocale)}
                    </td>
                    <td className="pl-2 text-right tabular-nums">
                      {formatRub(row.earned, numberLocale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.partners_total === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Send className="size-3.5 shrink-0" aria-hidden />
            {t('admin.stats.partnerEmpty')}
          </p>
        )}
      </div>
    </StatsWidgetCard>
  )
}
