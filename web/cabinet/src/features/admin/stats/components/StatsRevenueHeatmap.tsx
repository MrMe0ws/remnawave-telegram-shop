import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'

import type { AdminStatsHeatCellDTO } from '@/lib/types/admin'
import { cn } from '@/lib/utils'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { StatsWidgetCard } from './StatsWidgetCard'

interface StatsRevenueHeatmapProps {
  cells: AdminStatsHeatCellDTO[]
  /** Сдвиг часового пояса, в котором сервер посчитал часы (минуты от UTC). */
  tzOffsetMinutes: number
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
/** 24 колонки — вне стандартной шкалы Tailwind, поэтому сеткой правит стиль. */
const HOUR_GRID = { gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' } as const
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

interface HoverState {
  weekday: number
  hour: number
  revenue: number
  sales: number
}

/**
 * «Когда покупают» — выручка по дню недели и часу.
 *
 * Одна шкала, один тон: интенсивность — единственное, что здесь кодируется, и
 * радуга вместо неё сделала бы карту нечитаемой. Ширина фиксированная (24 часа
 * × 7 дней), поэтому на телефоне сетка прокручивается внутри своего контейнера,
 * а не ломает страницу.
 */
export function StatsRevenueHeatmap({
  cells,
  tzOffsetMinutes,
  className,
}: StatsRevenueHeatmapProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)
  const [hover, setHover] = useState<HoverState | null>(null)

  const { grid, max, total } = useMemo(() => {
    const map = new Map<string, AdminStatsHeatCellDTO>()
    let peak = 0
    let sum = 0
    for (const cell of cells) {
      map.set(`${cell.weekday}-${cell.hour}`, cell)
      if (cell.revenue_rub > peak) peak = cell.revenue_rub
      sum += cell.revenue_rub
    }
    return { grid: map, max: peak, total: sum }
  }, [cells])

  const weekdayNames = useMemo(
    () => WEEKDAYS.map((d) => t(`admin.stats.weekdayShort.${d}`)),
    [t],
  )

  const tzLabel = useMemo(() => {
    const sign = tzOffsetMinutes < 0 ? '-' : '+'
    const abs = Math.abs(tzOffsetMinutes)
    const h = String(Math.floor(abs / 60)).padStart(2, '0')
    const m = String(abs % 60).padStart(2, '0')
    return `UTC${sign}${h}:${m}`
  }, [tzOffsetMinutes])

  const peakCell = useMemo(() => {
    let best: AdminStatsHeatCellDTO | null = null
    for (const cell of cells) {
      if (!best || cell.revenue_rub > best.revenue_rub) best = cell
    }
    return best
  }, [cells])

  const readout = hover
    ? {
        when: `${weekdayNames[hover.weekday - 1]} ${String(hover.hour).padStart(2, '0')}:00`,
        revenue: formatRub(hover.revenue, numberLocale),
        sales: hover.sales,
      }
    : peakCell && peakCell.revenue_rub > 0
      ? {
          when: `${weekdayNames[peakCell.weekday - 1]} ${String(peakCell.hour).padStart(2, '0')}:00`,
          revenue: formatRub(peakCell.revenue_rub, numberLocale),
          sales: peakCell.sales,
        }
      : null

  return (
    <StatsWidgetCard
      icon={CalendarClock}
      title={t('admin.stats.heatmapTitle')}
      gradient="bg-gradient-to-r from-cyan-500 to-sky-500"
      accent="blue"
      className={className}
      headerExtra={
        <span className="shrink-0 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
          {tzLabel}
        </span>
      }
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="min-h-[2.5rem] rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm">
          {readout ? (
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-semibold tabular-nums">{readout.when}</span>
              <span className="font-semibold tabular-nums text-primary">{readout.revenue}</span>
              <span className="text-xs text-muted-foreground">
                {t('admin.stats.heatmapSales', { count: readout.sales })}
              </span>
              {!hover && (
                <span className="text-xs text-muted-foreground">
                  · {t('admin.stats.heatmapPeak')}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('admin.stats.heatmapEmpty')}</p>
          )}
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="min-w-[34rem]">
            <div className="flex gap-1">
              <div className="w-8 shrink-0" />
              <div className="grid flex-1 gap-[2px]" style={HOUR_GRID}>
                {HOURS.map((h) => (
                  <span
                    key={h}
                    className="text-center text-[9px] leading-none text-muted-foreground"
                  >
                    {h % 3 === 0 ? h : ''}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-1 space-y-[2px]">
              {WEEKDAYS.map((day) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="w-8 shrink-0 text-[11px] text-muted-foreground">
                    {weekdayNames[day - 1]}
                  </span>
                  <div className="grid flex-1 gap-[2px]" style={HOUR_GRID}>
                    {HOURS.map((hour) => {
                      const cell = grid.get(`${day}-${hour}`)
                      const value = cell?.revenue_rub ?? 0
                      const alpha = max > 0 && value > 0 ? 0.08 + (0.72 * value) / max : 0
                      const active = hover?.weekday === day && hover?.hour === hour
                      return (
                        <button
                          key={hour}
                          type="button"
                          aria-label={`${weekdayNames[day - 1]} ${hour}:00`}
                          onMouseEnter={() =>
                            setHover({ weekday: day, hour, revenue: value, sales: cell?.sales ?? 0 })
                          }
                          onMouseLeave={() => setHover(null)}
                          onClick={() =>
                            setHover({ weekday: day, hour, revenue: value, sales: cell?.sales ?? 0 })
                          }
                          className={cn(
                            'h-4 w-full rounded-[3px] border transition-colors',
                            active ? 'border-primary' : 'border-transparent',
                          )}
                          style={{
                            backgroundColor:
                              alpha > 0 ? `hsl(var(--primary) / ${alpha})` : 'hsl(var(--muted) / 0.4)',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>{t('admin.stats.heatmapTotal', { value: formatRub(total, numberLocale) })}</span>
          <span className="flex items-center gap-1.5">
            {t('admin.stats.heatmapLess')}
            {[0.08, 0.26, 0.44, 0.62, 0.8].map((a) => (
              <span
                key={a}
                className="size-3 rounded-[3px]"
                style={{ backgroundColor: `hsl(var(--primary) / ${a})` }}
              />
            ))}
            {t('admin.stats.heatmapMore')}
          </span>
        </div>
      </div>
    </StatsWidgetCard>
  )
}
