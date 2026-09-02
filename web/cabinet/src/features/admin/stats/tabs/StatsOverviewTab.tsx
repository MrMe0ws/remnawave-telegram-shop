import { useTranslation } from 'react-i18next'
import {
  Banknote,
  CreditCard,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'

import type { AdminStatsInsightsDTO, AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'

import { StatsGroupCard, type StatsGroupItem } from '../components/StatsGroupCard'
import { formatGrowthPct, formatRub, growthTrend, pctOf, statsNumberLocale } from '../utils/statsFormat'
import {
  paidConvPct,
  resolveStatsPeriodSlice,
  statsPeriodLabel,
  type StatsCustomRange,
  type StatsPeriod,
} from '../utils/statsPeriod'

interface StatsOverviewTabProps {
  data: AdminStatsResponse
  insights?: AdminStatsInsightsDTO | null
  timeseries?: AdminStatsTimeSeriesDTO | null
  period: StatsPeriod
  customRange?: StatsCustomRange | null
}

/**
 * «Обзор» — четыре смысловых блока: кто есть, что у них с подпиской, сколько
 * денег и куда всё это движется.
 *
 * Проценты роста берутся из insights (текущее окно против предыдущего такой же
 * длины). Так они считаются одинаково для любого периода, включая свой
 * диапазон, — раньше сравнение существовало только для календарного месяца.
 */
export function StatsOverviewTab({
  data,
  insights,
  timeseries,
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
  const paidShare = paidConvPct(data)

  const growth = (cur: number, prev: number | undefined) =>
    prev === undefined
      ? {}
      : { growthPct: formatGrowthPct(cur, prev), trend: growthTrend(cur, prev) }

  const usersItems: StatsGroupItem[] = [
    {
      icon: Users,
      label: t('admin.stats.totalCustomers'),
      value: data.total_customers.toLocaleString(numberLocale),
    },
    {
      icon: UserCheck,
      label: t('admin.stats.withActiveSub'),
      value: data.active_subscriptions.toLocaleString(numberLocale),
      hint: t('admin.stats.ofTotalPct', { pct: pctOf(data.active_subscriptions, data.total_customers) }),
    },
    {
      icon: UserPlus,
      label: t('admin.stats.newInPeriod', { period: periodLabel }),
      value: newUsers.toLocaleString(numberLocale),
    },
  ]

  const subsItems: StatsGroupItem[] = [
    {
      icon: Zap,
      label: t('admin.stats.activeNow'),
      value: activeVpn.toLocaleString(numberLocale),
      hint: t('admin.stats.trialOf', { count: data.trial_active }),
    },
    {
      icon: Wallet,
      label: t('admin.stats.paidAmongActive'),
      value: data.paid_active.toLocaleString(numberLocale),
    },
    {
      icon: Percent,
      label: t('admin.stats.paidShare'),
      value: `${paidShare}%`,
    },
  ]

  const financeItems: StatsGroupItem[] = [
    {
      icon: Banknote,
      label: t('admin.stats.revenuePeriodShort'),
      value: formatRub(revenue, numberLocale),
      ...growth(revenue, previous?.revenue_rub),
    },
    {
      icon: Receipt,
      label: t('admin.stats.avgCheck'),
      value: formatRub(avgCheck, numberLocale),
    },
    {
      icon: CreditCard,
      label: t('admin.stats.transactionsShort'),
      value: transactions.toLocaleString(numberLocale),
      ...growth(transactions, previous?.transactions),
    },
  ]

  const growthItems: StatsGroupItem[] = [
    {
      icon: UserPlus,
      label: t('admin.stats.growthUsers'),
      value: newUsers.toLocaleString(numberLocale),
      hint:
        previous !== undefined
          ? t('admin.stats.prevPeriodValue', {
              value: previous.new_users.toLocaleString(numberLocale),
            })
          : undefined,
      ...growth(newUsers, previous?.new_users),
    },
    {
      icon: ShoppingCart,
      label: t('admin.stats.growthSales'),
      value: sales.toLocaleString(numberLocale),
      hint:
        previous !== undefined
          ? t('admin.stats.prevPeriodValue', {
              value: previous.sales.toLocaleString(numberLocale),
            })
          : undefined,
      ...growth(sales, previous?.sales),
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StatsGroupCard
        icon={Users}
        title={t('admin.stats.users')}
        accent="blue"
        gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
        items={usersItems}
      />
      <StatsGroupCard
        icon={Zap}
        title={t('admin.stats.subscriptions')}
        accent="emerald"
        gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
        items={subsItems}
      />
      <StatsGroupCard
        icon={Wallet}
        title={t('admin.stats.financePeriod', { period: periodLabel })}
        accent="violet"
        gradient="bg-gradient-to-r from-violet-500 to-indigo-500"
        items={financeItems}
      />
      <StatsGroupCard
        icon={TrendingUp}
        title={t('admin.stats.growthTitle', { period: periodLabel })}
        accent="pink"
        gradient="bg-gradient-to-r from-pink-500 to-rose-500"
        items={growthItems}
        footer={
          previous === undefined ? (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {t('admin.stats.growthNoPrev')}
            </p>
          ) : undefined
        }
      />
    </div>
  )
}
