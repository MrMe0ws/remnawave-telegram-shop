import type { TFunction } from 'i18next'

import type { AdminStatsResponse, AdminStatsTariffRow } from '../../hooks/useAdminStats'
import { formatGrowthPct, formatRub, growthTrend, pctOf } from './statsFormat'

export type StatsPeriod = 'day' | 'week' | 'month' | 'half_year' | 'year' | 'all_time'

export const STATS_PERIOD_OPTIONS: StatsPeriod[] = [
  'day',
  'week',
  'month',
  'half_year',
  'year',
  'all_time',
]

export function statsPeriodLabel(t: TFunction, period: StatsPeriod): string {
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

export function getStatsPeriodSlice(data: AdminStatsResponse, period: StatsPeriod): PeriodSlice {
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

/** Доля платных и триалов среди активного VPN (как в TG «Сейчас активен VPN»). */
export function activeVpnBreakdown(data: AdminStatsResponse) {
  const active = data.trial_active + data.paid_active
  return {
    active,
    totalStates: active + data.inactive,
    paidShare: paidConvPct(data),
  }
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
  }
}

export function fortunePeriodKey(period: StatsPeriod): 'today' | 'month' | 'all_time' {
  if (period === 'day') return 'today'
  if (period === 'week' || period === 'month') return 'month'
  return 'all_time'
}
