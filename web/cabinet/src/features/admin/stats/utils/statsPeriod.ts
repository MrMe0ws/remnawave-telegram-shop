import type { TFunction } from 'i18next'

import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse, AdminStatsTariffRow } from '../../hooks/useAdminStats'
import { formatGrowthPct, formatRub, growthTrend, pctOf } from './statsFormat'

export type StatsPeriod = 'day' | 'week' | 'month' | 'half_year' | 'year' | 'all_time' | 'custom'

export type StatsCustomRange = { from: string; to: string }

export const STATS_PERIOD_OPTIONS: Exclude<StatsPeriod, 'custom'>[] = [
  'day',
  'week',
  'month',
  'half_year',
  'year',
  'all_time',
]

/** YYYY-MM-DD → DD.MM.YY */
export function formatStatsDateShort(isoDate: string, locale = 'ru-RU'): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function formatStatsCustomRangeLabel(range: StatsCustomRange, locale = 'ru-RU'): string {
  return `${formatStatsDateShort(range.from, locale)} – ${formatStatsDateShort(range.to, locale)}`
}

export function statsPeriodLabel(
  t: TFunction,
  period: StatsPeriod,
  opts?: { customRange?: StatsCustomRange | null; locale?: string },
): string {
  if (period === 'custom' && opts?.customRange) {
    return formatStatsCustomRangeLabel(opts.customRange, opts.locale ?? 'ru-RU')
  }
  return t(`admin.stats.period.${period}`)
}

export interface PeriodSlice {
  newUsers: number
  newUsersPrev: number | null
  sales: number
  salesPrev: number | null
  revenue: number
  revenueSubs: number | null
  transactions: number
  uniquePayers: number
  refBonus: number
}

const emptyPeriodSlice = (): PeriodSlice => ({
  newUsers: 0,
  newUsersPrev: null,
  sales: 0,
  salesPrev: null,
  revenue: 0,
  revenueSubs: null,
  transactions: 0,
  uniquePayers: 0,
  refBonus: 0,
})

export function periodSliceFromTimeseries(ts: AdminStatsTimeSeriesDTO): PeriodSlice {
  let newUsers = 0
  let sales = 0
  let revenue = 0
  let transactions = 0
  for (const p of ts.points) {
    newUsers += p.new_users
    sales += p.sales
    revenue += p.revenue_rub
    transactions += p.transactions
  }
  return {
    newUsers,
    newUsersPrev: null,
    sales,
    salesPrev: null,
    revenue,
    revenueSubs: null,
    transactions,
    uniquePayers: 0,
    refBonus: 0,
  }
}

export function resolveStatsPeriodSlice(
  data: AdminStatsResponse,
  period: StatsPeriod,
  timeseries?: AdminStatsTimeSeriesDTO | null,
): PeriodSlice {
  if (period === 'custom') {
    if (timeseries?.points?.length) return periodSliceFromTimeseries(timeseries)
    return emptyPeriodSlice()
  }
  return getStatsPeriodSlice(data, period)
}

export function getStatsPeriodSlice(
  data: AdminStatsResponse,
  period: Exclude<StatsPeriod, 'custom'>,
): PeriodSlice {
  switch (period) {
    case 'day':
      return {
        newUsers: data.new_today,
        newUsersPrev: null,
        sales: data.sales_sub_today,
        salesPrev: null,
        revenue: data.revenue_today_rub,
        revenueSubs: null,
        transactions: data.transactions_today,
        uniquePayers: data.unique_payers_day,
        refBonus: data.ref_bonus_days_today,
      }
    case 'week':
      return {
        newUsers: data.new_week,
        newUsersPrev: data.new_today,
        sales: data.sales_sub_week,
        salesPrev: data.sales_sub_today,
        revenue: data.revenue_week_rub,
        revenueSubs: null,
        transactions: data.transactions_week,
        uniquePayers: data.unique_payers_week,
        refBonus: data.ref_bonus_days_week,
      }
    case 'month':
      return {
        newUsers: data.new_month,
        newUsersPrev: data.new_prev_month,
        sales: data.sales_sub_month,
        salesPrev: data.sales_sub_prev_month,
        revenue: data.revenue_month_rub,
        revenueSubs: data.revenue_subs_month_rub,
        transactions: data.transactions_month,
        uniquePayers: data.unique_payers_month,
        refBonus: data.ref_bonus_days_month,
      }
    case 'half_year':
      return {
        newUsers: data.new_half_year,
        newUsersPrev: data.new_month,
        sales: data.sales_sub_half_year,
        salesPrev: data.sales_sub_month,
        revenue: data.revenue_half_year_rub,
        revenueSubs: null,
        transactions: data.transactions_half_year,
        uniquePayers: data.unique_payers_half_year,
        refBonus: data.ref_bonus_days_half_year,
      }
    case 'year':
      return {
        newUsers: data.new_year,
        newUsersPrev: data.new_half_year,
        sales: data.sales_sub_year,
        salesPrev: data.sales_sub_half_year,
        revenue: data.revenue_year_rub,
        revenueSubs: null,
        transactions: data.transactions_year,
        uniquePayers: data.unique_payers_year,
        refBonus: data.ref_bonus_days_year,
      }
    case 'all_time':
      return {
        newUsers: data.total_customers,
        newUsersPrev: null,
        sales: data.sales_sub_year,
        salesPrev: null,
        revenue: data.revenue_all_time_rub,
        revenueSubs: data.revenue_subs_month_rub,
        transactions: data.transactions_year,
        uniquePayers: data.unique_payers_year,
        refBonus: data.ref_bonus_days_all,
      }
  }
}

export function buildGrowth(cur: number, prev: number | null) {
  if (prev === null) return undefined
  return {
    pct: formatGrowthPct(cur, prev),
    trend: growthTrend(cur, prev),
  }
}

export function activeSubsPct(data: AdminStatsResponse): string {
  return pctOf(data.active_subscriptions, data.total_customers)
}

export function paidConvPct(data: AdminStatsResponse): string {
  const den = data.trial_active + data.paid_active
  return pctOf(data.paid_active, den)
}

export function formatPeriodRub(value: number, locale: string): string {
  return formatRub(value, locale)
}

export function tariffPeriodSales(row: AdminStatsTariffRow, period: StatsPeriod): number {
  switch (period) {
    case 'day':
      return row.sales_today
    case 'week':
      return row.sales_week
    case 'month':
      return row.sales_month
    case 'half_year':
      return row.sales_half_year
    case 'year':
    case 'all_time':
      return row.sales_year
    case 'custom':
      return 0
  }
}

export function tariffPeriodRevenue(row: AdminStatsTariffRow, period: StatsPeriod): number {
  switch (period) {
    case 'day':
      return row.revenue_today
    case 'week':
      return row.revenue_week
    case 'month':
      return row.subs_revenue_month
    case 'half_year':
      return row.revenue_half_year
    case 'year':
      return row.revenue_year
    case 'all_time':
      return row.revenue_all
    case 'custom':
      return 0
  }
}

export function fortunePeriodKey(period: StatsPeriod): 'today' | 'month' | 'all_time' {
  if (period === 'day') return 'today'
  if (period === 'week' || period === 'month' || period === 'custom') return 'month'
  return 'all_time'
}

/** Пресет для виджетов без timeseries (рефералы и т.п.) при кастомном диапазоне. */
export function snapshotFallbackPeriod(period: StatsPeriod): Exclude<StatsPeriod, 'custom'> {
  return period === 'custom' ? 'month' : period
}
