import type { AdminStatsTimeSeriesDTO, AdminTariffTimeSeriesDTO } from '@/lib/types/admin'

export function formatTimeseriesLabel(
  date: string,
  granularity: AdminStatsTimeSeriesDTO['granularity'],
  locale: string,
): string {
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  if (granularity === 'month') {
    return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
  }
  if (granularity === 'week') {
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
  }
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}

export function findTariffTimeSeries(
  series: AdminTariffTimeSeriesDTO[] | undefined,
  tariffId: number,
): AdminTariffTimeSeriesDTO | undefined {
  return series?.find((s) => s.tariff_id === tariffId)
}

export function tariffSeriesSparklineValues(
  series: AdminTariffTimeSeriesDTO | undefined,
  field: 'sales' | 'revenue_rub',
): number[] {
  if (!series?.points.length) return []
  return series.points.map((p) => (field === 'sales' ? p.sales : p.revenue_rub))
}
