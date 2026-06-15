import type { TFunction } from 'i18next'

import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import { formatPeriodRub, type StatsPeriod } from './statsPeriod'

export interface TrendPoint {
  key: string
  label: string
  value: number
}

export function buildRevenueTrend(data: AdminStatsResponse, t: TFunction, period: StatsPeriod): TrendPoint[] {
  const all: TrendPoint[] = [
    { key: 'day', label: t('admin.stats.period.day'), value: data.revenue_today_rub },
    { key: 'week', label: t('admin.stats.period.week'), value: data.revenue_week_rub },
    { key: 'month', label: t('admin.stats.period.month'), value: data.revenue_month_rub },
    { key: 'half_year', label: t('admin.stats.period.half_year'), value: data.revenue_half_year_rub },
    { key: 'year', label: t('admin.stats.period.year'), value: data.revenue_year_rub },
    { key: 'all_time', label: t('admin.stats.period.all_time'), value: data.revenue_all_time_rub },
  ]
  return sliceTrendForPeriod(all, period)
}

export function buildSalesTrend(data: AdminStatsResponse, t: TFunction, period: StatsPeriod): TrendPoint[] {
  const all: TrendPoint[] = [
    { key: 'day', label: t('admin.stats.period.day'), value: data.sales_sub_today },
    { key: 'week', label: t('admin.stats.period.week'), value: data.sales_sub_week },
    { key: 'month', label: t('admin.stats.period.month'), value: data.sales_sub_month },
    { key: 'prev_month', label: t('admin.stats.newPrevMonth'), value: data.sales_sub_prev_month },
    { key: 'half_year', label: t('admin.stats.period.half_year'), value: data.sales_sub_half_year },
    { key: 'year', label: t('admin.stats.period.year'), value: data.sales_sub_year },
  ]
  return sliceTrendForPeriod(all, period)
}

export function buildNewUsersTrend(data: AdminStatsResponse, t: TFunction, period: StatsPeriod): TrendPoint[] {
  const all: TrendPoint[] = [
    { key: 'day', label: t('admin.stats.period.day'), value: data.new_today },
    { key: 'week', label: t('admin.stats.period.week'), value: data.new_week },
    { key: 'month', label: t('admin.stats.period.month'), value: data.new_month },
    { key: 'prev_month', label: t('admin.stats.newPrevMonth'), value: data.new_prev_month },
    { key: 'half_year', label: t('admin.stats.period.half_year'), value: data.new_half_year },
    { key: 'year', label: t('admin.stats.period.year'), value: data.new_year },
  ]
  return sliceTrendForPeriod(all, period)
}

export function buildReferralTrend(data: AdminStatsResponse, t: TFunction, period: StatsPeriod): TrendPoint[] {
  const all: TrendPoint[] = [
    { key: 'day', label: t('admin.stats.period.day'), value: data.ref_bonus_days_today },
    { key: 'week', label: t('admin.stats.period.week'), value: data.ref_bonus_days_week },
    { key: 'month', label: t('admin.stats.period.month'), value: data.ref_bonus_days_month },
    { key: 'half_year', label: t('admin.stats.period.half_year'), value: data.ref_bonus_days_half_year },
    { key: 'year', label: t('admin.stats.period.year'), value: data.ref_bonus_days_year },
    { key: 'all_time', label: t('admin.stats.period.all_time'), value: data.ref_bonus_days_all },
  ]
  return sliceTrendForPeriod(all, period)
}

function sliceTrendForPeriod(points: TrendPoint[], period: StatsPeriod): TrendPoint[] {
  const order: (StatsPeriod | 'prev_month')[] = [
    'day',
    'week',
    'month',
    'prev_month',
    'half_year',
    'year',
    'all_time',
  ]
  const endIdx = order.indexOf(period === 'all_time' ? 'all_time' : period)
  if (endIdx <= 0) return points.slice(0, 1)
  const allowed = new Set<string>(order.slice(0, endIdx + 1))
  if (period === 'month') allowed.add('prev_month')
  return points.filter((p) => allowed.has(p.key))
}

export function formatChartValue(
  value: number,
  kind: 'number' | 'currency',
  locale: string,
): string {
  if (kind === 'currency') return formatPeriodRub(value, locale)
  return value.toLocaleString(locale)
}
