import { useTranslation } from 'react-i18next'
import {
  CreditCard,
  LogOut,
  Package,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'

import type { AdminStatsInsightsDTO, AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminFortuneStatsResponse } from '../../hooks/useAdminFortuneStats'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import { formatInvoiceType } from '../../utils/formatInvoiceType'

import { StatsMainChart } from '../components/StatsMainChart'
import { StatsMiniCard, StatsDelta } from '../components/StatsKpiCard'
import { StatsPanel, StatsPanelHead, StatsStatRow } from '../components/StatsPanel'
import {
  formatGrowthPct,
  formatPct,
  formatRub,
  growthTrend,
  statsNumberLocale,
} from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import {
  fortunePeriodKey,
  resolveStatsPeriodSlice,
  statsPeriodLabel,
  tariffPeriodRevenue,
  tariffPeriodSales,
  type StatsCustomRange,
  type StatsPeriod,
} from '../utils/statsPeriod'

interface StatsOverviewTabProps {
  data: AdminStatsResponse
  insights?: AdminStatsInsightsDTO | null
  timeseries?: AdminStatsTimeSeriesDTO | null
  fortune?: AdminFortuneStatsResponse | null
  period: StatsPeriod
  customRange?: StatsCustomRange | null
}

/**
 * «Обзор» — четыре смысловых блока, график и четыре производных числа.
 *
 * Проценты роста берутся из insights (текущее окно против предыдущего такой же
 * длины). Так они считаются одинаково для любого периода, включая свой
 * диапазон, — раньше сравнение существовало только для календарного месяца.
 */
export function StatsOverviewTab({
  data,
  insights,
  timeseries,
  fortune,
  period,
  customRange,
}: StatsOverviewTabProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const periodLabel = statsPeriodLabel(t, period, { customRange, locale })

  const slice = resolveStatsPeriodSlice(data, period, timeseries)
  const current = insights?.current
  const previous = insights?.previous

  const revenue = current?.revenue_rub ?? slice.revenue
  const transactions = current?.transactions ?? slice.transactions
  const newUsers = current?.new_users ?? slice.newUsers
  const sales = current?.sales ?? slice.sales
  const avgCheck = transactions > 0 ? revenue / transactions : 0

  const activeVpn = data.trial_active + data.paid_active
  const deltaNote = t('admin.stats.deltaNote')

  const delta = (cur: number, prev: number | undefined) =>
    prev === undefined ? null : (
      <StatsDelta
        pct={formatGrowthPct(cur, prev)}
        trend={growthTrend(cur, prev)}
        note={deltaNote}
      />
    )

  // Производные карточки: главная касса, ходовой тариф, ушедшие плательщики и
  // баланс колеса. Каждая отвечает на вопрос, который иначе пришлось бы
  // высчитывать глазами из таблиц ниже.
  const topGateway = (insights?.gateways ?? [])
    .slice()
    .sort((a, b) => b.revenue_rub - a.revenue_rub)[0]
  const gatewayTotal = (insights?.gateways ?? []).reduce((sum, g) => sum + g.revenue_rub, 0)

  const topTariff = (data.tariff_breakdown ?? [])
    .map((row) => ({
      name: row.display_name,
      sales: tariffPeriodSales(row, period),
      revenue: tariffPeriodRevenue(row, period),
    }))
    .sort((a, b) => b.revenue - a.revenue)[0]
  const tariffTotal = (data.tariff_breakdown ?? []).reduce(
    (sum, row) => sum + tariffPeriodRevenue(row, period),
    0,
  )

  const fortuneSlice = fortune?.[fortunePeriodKey(period)]
  const fortuneNet = fortuneSlice
    ? fortuneSlice.paid_cost_days_sum - fortuneSlice.won_subs_days_sum
    : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsPanel>
          <StatsPanelHead
            icon={Users}
            color={STATS_ACCENT.blue}
            title={t('admin.stats.users')}
          />
          <StatsStatRow
            label={t('admin.stats.totalCustomers')}
            value={data.total_customers.toLocaleString(numberLocale)}
          />
          <StatsStatRow
            label={t('admin.stats.withActiveSub')}
            value={data.active_subscriptions.toLocaleString(numberLocale)}
          />
          <StatsStatRow
            label={t('admin.stats.newInPeriodShort')}
            value={newUsers.toLocaleString(numberLocale)}
            last
          />
        </StatsPanel>

        <StatsPanel>
          <StatsPanelHead
            icon={ShieldCheck}
            color={STATS_ACCENT.green}
            title={t('admin.stats.subscriptions')}
          />
          <StatsStatRow
            label={t('admin.stats.activeNow')}
            value={activeVpn.toLocaleString(numberLocale)}
          />
          <StatsStatRow
            label={t('admin.stats.paidAmongActive')}
            value={data.paid_active.toLocaleString(numberLocale)}
          />
          <StatsStatRow
            label={t('admin.stats.paidShare')}
            value={`${formatPct(data.paid_active, activeVpn, numberLocale)}%`}
            accentValue
            last
          />
        </StatsPanel>

        <StatsPanel>
          <StatsPanelHead
            icon={Wallet}
            color={STATS_ACCENT.amber}
            title={t('admin.stats.finance')}
          />
          <StatsStatRow
            label={t('admin.stats.revenuePeriodShort')}
            value={formatRub(revenue, numberLocale)}
          />
          <StatsStatRow
            label={t('admin.stats.avgCheck')}
            value={formatRub(avgCheck, numberLocale)}
          />
          <StatsStatRow
            label={t('admin.stats.transactionsShort')}
            value={transactions.toLocaleString(numberLocale)}
            last
          />
        </StatsPanel>

        <StatsPanel>
          <StatsPanelHead
            icon={TrendingUp}
            color={STATS_ACCENT.orange}
            title={t('admin.stats.growth')}
          />
          <StatsStatRow
            label={t('admin.stats.growthUsers')}
            value={newUsers.toLocaleString(numberLocale)}
            note={delta(newUsers, previous?.new_users)}
          />
          <StatsStatRow
            label={t('admin.stats.growthSales')}
            value={sales.toLocaleString(numberLocale)}
            note={delta(sales, previous?.sales)}
            last
          />
        </StatsPanel>
      </div>

      <StatsMainChart timeseries={timeseries} period={period} customRange={customRange} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatsMiniCard
          icon={CreditCard}
          color={STATS_ACCENT.blue}
          label={t('admin.stats.topGateway')}
          value={topGateway ? formatInvoiceType(topGateway.invoice_type, t) : '—'}
          hint={
            topGateway && gatewayTotal > 0
              ? t('admin.stats.topGatewayHint', {
                  pct: Math.round((topGateway.revenue_rub * 100) / gatewayTotal),
                  value: formatRub(topGateway.revenue_rub, numberLocale),
                })
              : undefined
          }
        />
        <StatsMiniCard
          icon={Package}
          color={STATS_ACCENT.orange}
          label={t('admin.stats.topTariff')}
          value={topTariff?.name ?? '—'}
          hint={
            topTariff && tariffTotal > 0
              ? t('admin.stats.topTariffHint', {
                  pct: Math.round((topTariff.revenue * 100) / tariffTotal),
                  sales: topTariff.sales,
                })
              : undefined
          }
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
        <StatsMiniCard
          icon={RotateCcw}
          color={STATS_ACCENT.violet}
          label={t('admin.stats.fortune')}
          value={
            fortuneNet === null
              ? '—'
              : `${fortuneNet > 0 ? '+' : fortuneNet < 0 ? '−' : ''}${Math.abs(fortuneNet).toLocaleString(numberLocale)}`
          }
          valueClassName={fortuneNet !== null && fortuneNet < 0 ? 'text-rose-500' : undefined}
          hint={t('admin.stats.fortuneNetHint')}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t('admin.stats.overviewPeriodNote', { period: periodLabel })}
      </p>
    </div>
  )
}
