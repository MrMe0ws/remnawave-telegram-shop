import { useTranslation } from 'react-i18next'
import { Package, RussianRuble, Tag } from 'lucide-react'

import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { seriesColor, STATS_ACCENT } from '../utils/statsPalette'
import {
  tariffPeriodRevenue,
  tariffPeriodSales,
  type StatsPeriod,
} from '../utils/statsPeriod'
import { StatsBar, StatsDot, StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsTariffsBlockProps {
  rows: AdminStatsResponse['tariff_breakdown']
  period: StatsPeriod
  timeseries?: AdminStatsTimeSeriesDTO | null
  className?: string
}

/** Тарифы: продажи, выручка и доля выручки за период. */
export function StatsTariffsBlock({
  rows,
  period,
  timeseries,
  className,
}: StatsTariffsBlockProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  // На своём диапазоне снимок не помогает — суммы берутся из ряда по дням.
  const data =
    period === 'custom' && timeseries?.tariff_series.length
      ? timeseries.tariff_series.map((ts) => ({
          name: ts.display_name,
          sales: ts.points.reduce((sum, p) => sum + p.sales, 0),
          revenue: ts.points.reduce((sum, p) => sum + p.revenue_rub, 0),
        }))
      : rows.map((row) => ({
          name: row.display_name,
          sales: tariffPeriodSales(row, period),
          revenue: tariffPeriodRevenue(row, period),
        }))

  const ranked = [...data].sort((a, b) => b.revenue - a.revenue)
  const total = ranked.reduce((sum, row) => sum + row.revenue, 0)

  if (ranked.length === 0) return null

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={Package}
        color={STATS_ACCENT.orange}
        title={t('admin.stats.tariffBreakdown')}
        subtitle={t('admin.stats.tariffsSubtitle')}
      />

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="grid min-w-[26rem] grid-cols-[minmax(0,1.3fr)_5rem_7rem_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 text-[13px]">
          <div className="text-xs text-muted-foreground">{t('admin.stats.tariffName')}</div>
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <Tag className="size-3.5 shrink-0" aria-hidden />
            {t('admin.stats.tariffColSales')}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <RussianRuble className="size-3.5 shrink-0" aria-hidden />
            {t('admin.stats.tariffColRevenue')}
          </div>
          <div className="text-xs text-muted-foreground">{t('admin.stats.tariffColShare')}</div>

          {ranked.map((row, i) => {
            const color = seriesColor(i)
            const share = total > 0 ? (row.revenue * 100) / total : 0
            return (
              <Row
                key={row.name}
                color={color}
                name={row.name}
                sales={row.sales.toLocaleString(numberLocale)}
                revenue={formatRub(row.revenue, numberLocale)}
                share={share}
              />
            )
          })}
        </div>
      </div>
    </StatsPanel>
  )
}

function Row({
  color,
  name,
  sales,
  revenue,
  share,
}: {
  color: string
  name: string
  sales: string
  revenue: string
  share: number
}) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <StatsDot color={color} />
        <span className="truncate">{name}</span>
      </div>
      <div className="text-right tabular-nums">{sales}</div>
      <div className="text-right tabular-nums">{revenue}</div>
      <div className="flex items-center gap-2">
        <StatsBar percent={share} color={color} className="flex-1" />
        <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.round(share)}%
        </span>
      </div>
    </>
  )
}
