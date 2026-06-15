import { useTranslation } from 'react-i18next'
import { Table2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AdminStatsTimeSeriesDTO } from '@/lib/types/admin'
import type { AdminStatsResponse } from '../../hooks/useAdminStats'
import {
  formatPeriodRub,
  statsPeriodLabel,
  tariffPeriodRevenue,
  tariffPeriodSales,
  type StatsPeriod,
} from '../utils/statsPeriod'
import { statsNumberLocale } from '../utils/statsFormat'
import { STATS_CHART_PALETTE } from '../utils/statsChartTheme'
import { findTariffTimeSeries, tariffSeriesSparklineValues } from '../utils/timeseriesFormat'

import { TariffSparkline } from './TariffSparkline'

interface TariffsStatsTableProps {
  rows: AdminStatsResponse['tariff_breakdown']
  period: StatsPeriod
  timeseries?: AdminStatsTimeSeriesDTO | null
}

export function TariffsStatsTable({ rows, period, timeseries }: TariffsStatsTableProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  if (rows.length === 0) return null

  return (
    <Card className="cabinet-elevated-card overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-slate-500 to-zinc-500" />
      <CardHeader className="flex flex-row items-center gap-3 px-4 pb-1 pt-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 dark:bg-slate-500/20">
          <Table2 className="size-4 text-slate-400" />
        </div>
        <CardTitle className="text-base">
          {t('admin.stats.tariffTableTitle')} · {statsPeriodLabel(t, period)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-0 sm:px-4">
        <table className="w-full table-fixed text-xs sm:text-sm md:table-auto">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="w-[38%] pb-2 pr-1 font-medium sm:pr-4 md:w-auto">{t('admin.stats.tariffName')}</th>
              <th className="hidden w-24 pb-2 pr-4 text-center font-medium lg:table-cell">
                {t('admin.stats.trend')}
              </th>
              <th className="w-[31%] pb-2 pr-1 text-right font-medium leading-tight sm:pr-4 md:w-auto">
                <span className="md:hidden">{t('admin.stats.salesShort')}</span>
                <span className="hidden md:inline">{t('admin.stats.sales')}</span>
              </th>
              <th className="w-[31%] pb-2 text-right font-medium md:pr-4 md:w-auto">{t('admin.stats.revenue')}</th>
              <th className="hidden pb-2 text-right font-medium md:table-cell">{t('admin.stats.activePaidUsers')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tr, idx) => {
              const tariffSeries = findTariffTimeSeries(timeseries?.tariff_series, tr.tariff_id)
              const sparkValues = tariffSeriesSparklineValues(tariffSeries, 'sales')
              return (
              <tr
                key={tr.tariff_id}
                className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/20"
              >
                <td className="py-2 pr-1 sm:py-2.5 sm:pr-4">
                  <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: STATS_CHART_PALETTE[idx % STATS_CHART_PALETTE.length],
                      }}
                    />
                    <span className="truncate font-medium">{tr.display_name}</span>
                  </div>
                </td>
                <td className="hidden py-2.5 pr-4 lg:table-cell">
                  <TariffSparkline
                    values={sparkValues}
                    color={STATS_CHART_PALETTE[idx % STATS_CHART_PALETTE.length]}
                  />
                </td>
                <td className="py-2 pr-1 text-right tabular-nums sm:py-2.5 sm:pr-4">
                  {tariffPeriodSales(tr, period).toLocaleString(numberLocale)}
                </td>
                <td className="py-2 text-right tabular-nums sm:py-2.5 md:pr-4">
                  {formatPeriodRub(tariffPeriodRevenue(tr, period), numberLocale)}
                </td>
                <td className="hidden py-2.5 text-right tabular-nums md:table-cell">
                  {tr.active_paid_users.toLocaleString(numberLocale)}
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
