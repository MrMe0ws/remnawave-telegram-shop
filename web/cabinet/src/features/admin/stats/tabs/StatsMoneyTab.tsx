import { useTranslation } from 'react-i18next'
import { CreditCard, Receipt, Users, Wallet } from 'lucide-react'

import type { AdminStatsInsightsDTO, AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import { formatInvoiceType } from '../../utils/formatInvoiceType'

import { StatsFunnelBlock } from '../components/StatsFunnelBlock'
import { StatsMainChart } from '../components/StatsMainChart'
import { StatsRenewalsSplit } from '../components/StatsRenewalsSplit'
import { StatsRevenueHeatmap } from '../components/StatsRevenueHeatmap'
import { StatsWidgetCard } from '../components/StatsWidgetCard'
import { TariffsOverviewChart } from '../components/TariffsOverviewChart'
import { TariffsStatsTable } from '../components/TariffsStatsTable'
import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import {
  resolveStatsPeriodSlice,
  statsPeriodLabel,
  type StatsCustomRange,
  type StatsPeriod,
} from '../utils/statsPeriod'

interface StatsMoneyTabProps {
  data: AdminStatsResponse
  insights?: AdminStatsInsightsDTO | null
  timeseries?: AdminStatsTimeSeriesDTO | null
  period: StatsPeriod
  customRange?: StatsCustomRange | null
}

export function StatsMoneyTab({
  data,
  insights,
  timeseries,
  period,
  customRange,
}: StatsMoneyTabProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const periodLabel = statsPeriodLabel(t, period, { customRange, locale })

  const slice = resolveStatsPeriodSlice(data, period, timeseries)
  const revenue = insights?.current.revenue_rub ?? slice.revenue
  const transactions = insights?.current.transactions ?? slice.transactions
  const payers = insights?.current.unique_payers ?? slice.uniquePayers
  const avgCheck = transactions > 0 ? revenue / transactions : 0
  const arppu = payers > 0 ? revenue / payers : 0

  const tariffRows = data.tariff_breakdown ?? []

  // Кассы за период приходят из insights; пока их нет, показываем разбивку за
  // всё время из снимка — она была на странице и раньше.
  const gateways = insights?.gateways?.length
    ? insights.gateways.map((g) => ({
        key: g.invoice_type,
        revenue: g.revenue_rub,
        payments: g.payments as number | null,
      }))
    : Object.entries(data.payment_rub_by_invoice ?? {}).map(([key, value]) => ({
        key,
        revenue: value,
        payments: null,
      }))
  const gatewaysTotal = gateways.reduce((sum, g) => sum + g.revenue, 0)
  const gatewaysScoped = Boolean(insights?.gateways?.length)

  const kpis = [
    { icon: Wallet, label: t('admin.stats.revenuePeriodShort'), value: formatRub(revenue, numberLocale) },
    { icon: Receipt, label: t('admin.stats.avgCheck'), value: formatRub(avgCheck, numberLocale) },
    { icon: CreditCard, label: t('admin.stats.transactionsShort'), value: transactions.toLocaleString(numberLocale) },
    { icon: Users, label: t('admin.stats.arppu'), value: formatRub(arppu, numberLocale) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const KpiIcon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 sm:block"
            >
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <KpiIcon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{kpi.label}</span>
              </p>
              <p className="shrink-0 text-xl font-bold tabular-nums sm:mt-1 sm:text-2xl">
                {kpi.value}
              </p>
            </div>
          )
        })}
      </div>

      <StatsMainChart timeseries={timeseries} period={period} customRange={customRange} />

      <div className="grid gap-4 lg:grid-cols-2">
        {insights && <StatsFunnelBlock funnel={insights.funnel} />}
        {insights && <StatsRenewalsSplit renewals={insights.renewals} />}
      </div>

      {gateways.length > 0 && (
        <StatsWidgetCard
          icon={CreditCard}
          title={
            gatewaysScoped
              ? `${t('admin.stats.paymentByInvoice')} · ${periodLabel}`
              : t('admin.stats.paymentByInvoice')
          }
          gradient="bg-gradient-to-r from-slate-500 to-zinc-500"
          accent="slate"
        >
          <ul className="space-y-2">
            {gateways.map((gw) => {
              const share = gatewaysTotal > 0 ? (gw.revenue * 100) / gatewaysTotal : 0
              return (
                <li key={gw.key}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{formatInvoiceType(gw.key, t)}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{formatRub(gw.revenue, numberLocale)}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {share.toFixed(1)}%
                      </span>
                      {gw.payments !== null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          · {t('admin.stats.paymentsCount', { count: gw.payments })}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max(share, gw.revenue > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          {!gatewaysScoped && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t('admin.stats.paymentByInvoiceHint')}
            </p>
          )}
        </StatsWidgetCard>
      )}

      {tariffRows.length > 0 && (
        <>
          <TariffsOverviewChart
            rows={tariffRows}
            period={period}
            timeseries={timeseries}
            customRange={customRange}
          />
          <TariffsStatsTable
            rows={tariffRows}
            period={period}
            timeseries={timeseries}
            customRange={customRange}
          />
        </>
      )}

      {insights && (
        <StatsRevenueHeatmap
          cells={insights.heatmap}
          tzOffsetMinutes={insights.tz_offset_minutes}
        />
      )}
    </div>
  )
}
