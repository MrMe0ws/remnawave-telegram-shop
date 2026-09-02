import type { TFunction } from 'i18next'

import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import type { StatsPeriod } from './statsPeriod'

export interface TrendPoint {
  key: string
  label: string
  value: number
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

function sliceTrendForPeriod(points: TrendPoint[], period: StatsPeriod): TrendPoint[] {
  const effective = period === 'custom' ? 'month' : period
  const order: (StatsPeriod | 'prev_month')[] = [
    'day',
    'week',
    'month',
    'prev_month',
    'half_year',
    'year',
    'all_time',
  ]
  const endIdx = order.indexOf(effective === 'all_time' ? 'all_time' : effective)
  if (endIdx <= 0) return points.slice(0, 1)
  const allowed = new Set<string>(order.slice(0, endIdx + 1))
  if (effective === 'month') allowed.add('prev_month')
  return points.filter((p) => allowed.has(p.key))
}

