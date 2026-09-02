import { useTranslation } from 'react-i18next'
import {
  CircleX,
  CreditCard,
  LogOut,
  Receipt,
  RotateCcw,
  RussianRuble,
  UserCheck,
  Users,
} from 'lucide-react'

import type { AdminStatsInsightsDTO, AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'

import { StatsFunnelBlock } from '../components/StatsFunnelBlock'
import { StatsGatewaysBlock, type GatewayRow } from '../components/StatsGatewaysBlock'
import { StatsDelta, StatsKpiCard, StatsMiniCard } from '../components/StatsKpiCard'
import { StatsMainChart } from '../components/StatsMainChart'
import { StatsRenewalsSplit } from '../components/StatsRenewalsSplit'
import { StatsRevenueHeatmap } from '../components/StatsRevenueHeatmap'
import { StatsTariffsBlock } from '../components/StatsTariffsBlock'
import {
  formatDecimal,
  formatGrowthPct,
  formatPct,
  formatRub,
  growthTrend,
  statsNumberLocale,
} from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import {
  resolveStatsPeriodSlice,
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

  const slice = resolveStatsPeriodSlice(data, period, timeseries)
  const current = insights?.current
  const previous = insights?.previous

  const revenue = current?.revenue_rub ?? slice.revenue
  const transactions = current?.transactions ?? slice.transactions
  const payers = current?.unique_payers ?? slice.uniquePayers
  const avgCheck = transactions > 0 ? revenue / transactions : 0
  const arppu = payers > 0 ? revenue / payers : 0
  const frequency = payers > 0 ? transactions / payers : 0

  const unpaidInvoices = insights
    ? Math.max(insights.funnel.invoices_created - insights.funnel.invoices_paid, 0)
    : null

  const deltaNote = t('admin.stats.deltaNote')
  const delta = (cur: number, prev: number | undefined) =>
    prev === undefined ? undefined : (
      <StatsDelta pct={formatGrowthPct(cur, prev)} trend={growthTrend(cur, prev)} note={deltaNote} />
    )

  // Кассы за период приходят из insights; пока их нет, показываем разбивку за
  // всё время из снимка — она была на странице и раньше.
  const gatewaysScoped = Boolean(insights?.gateways?.length)
  const gateways: GatewayRow[] = gatewaysScoped
    ? insights!.gateways.map((g) => ({
        key: g.invoice_type,
        revenue: g.revenue_rub,
        payments: g.payments,
      }))
    : Object.entries(data.payment_rub_by_invoice ?? {})
        .map(([key, value]) => ({ key, revenue: value, payments: null }))
        .sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsKpiCard
          icon={RussianRuble}
          color={STATS_ACCENT.cyan}
          label={t('admin.stats.revenuePeriodShort')}
          value={formatRub(revenue, numberLocale)}
          hint={delta(revenue, previous?.revenue_rub)}
        />
        <StatsKpiCard
          icon={CreditCard}
          color={STATS_ACCENT.blue}
          label={t('admin.stats.transactionsShort')}
          value={transactions.toLocaleString(numberLocale)}
          hint={delta(transactions, previous?.transactions)}
        />
        <StatsKpiCard
          icon={UserCheck}
          color={STATS_ACCENT.green}
          label={t('admin.stats.uniquePayers')}
          value={payers.toLocaleString(numberLocale)}
          hint={
            <span className="text-muted-foreground">
              {t('admin.stats.uniquePayersHint', {
                value: data.active_subscriptions.toLocaleString(numberLocale),
              })}
            </span>
          }
        />
        <StatsKpiCard
          icon={CircleX}
          color={STATS_ACCENT.red}
          label={t('admin.stats.unpaidInvoices')}
          value={unpaidInvoices === null ? '—' : unpaidInvoices.toLocaleString(numberLocale)}
          hint={
            <span className="text-muted-foreground">{t('admin.stats.unpaidInvoicesHint')}</span>
          }
        />
      </div>

      <StatsMainChart timeseries={timeseries} period={period} customRange={customRange} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatsMiniCard
          icon={Receipt}
          color={STATS_ACCENT.cyan}
          label={t('admin.stats.avgCheck')}
          value={formatRub(avgCheck, numberLocale)}
          hint={t('admin.stats.avgCheckHint')}
        />
        <StatsMiniCard
          icon={Users}
          color={STATS_ACCENT.green}
          label={t('admin.stats.arppu')}
          value={formatRub(arppu, numberLocale)}
          hint={t('admin.stats.arppuHint', { count: payers })}
        />
        <StatsMiniCard
          icon={RotateCcw}
          color={STATS_ACCENT.amber}
          label={t('admin.stats.purchasesPerPayer')}
          value={formatDecimal(frequency, numberLocale)}
          hint={t('admin.stats.purchasesPerPayerHint')}
        />
        <StatsMiniCard
          icon={LogOut}
          color={STATS_ACCENT.red}
          label={t('admin.stats.churnedPayers')}
          value={data.inactive_paid.toLocaleString(numberLocale)}
          hint={t('admin.stats.churnedPayersHint', {
            pct: formatPct(data.inactive_paid, data.inactive_paid + data.paid_active, numberLocale),
          })}
        />
      </div>

      {insights && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <StatsFunnelBlock funnel={insights.funnel} />
          <StatsRenewalsSplit renewals={insights.renewals} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {gateways.length > 0 && <StatsGatewaysBlock rows={gateways} scoped={gatewaysScoped} />}
        <StatsTariffsBlock
          rows={data.tariff_breakdown ?? []}
          period={period}
          timeseries={timeseries}
        />
      </div>

      {insights && (
        <StatsRevenueHeatmap
          cells={insights.heatmap}
          tzOffsetMinutes={insights.tz_offset_minutes}
        />
      )}
    </div>
  )
}
