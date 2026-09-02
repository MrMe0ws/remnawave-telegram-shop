import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

import type { AdminStatsHeatCellDTO } from '@/lib/types/admin'

import { formatRub, statsNumberLocale } from '../utils/statsFormat'
import { STATS_ACCENT } from '../utils/statsPalette'
import { StatsPanel, StatsPanelHead } from './StatsPanel'

interface StatsRevenueHeatmapProps {
  cells: AdminStatsHeatCellDTO[]
  /** Сдвиг часового пояса, в котором сервер посчитал часы (минуты от UTC). */
  tzOffsetMinutes: number
  className?: string
}

/** Часы сведены в шестичасовые полосы по четыре часа. */
const BUCKETS = [0, 4, 8, 12, 16, 20]
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/**
 * «Когда покупают» — выручка по дням недели и часам.
 *
 * Один тон, разная плотность: интенсивность здесь — единственное, что
 * кодируется, и радуга вместо неё сделала бы карту нечитаемой.
 *
 * Часы сгруппированы по четыре. Сетка 7×24 не помещается ни на один телефон и
 * распадается на пиксельную пыль, где отдельная ячейка ничего не значит; в
 * четырёхчасовой полосе видно то, ради чего карту и смотрят, — вечер это или
 * утро, будни или выходные.
 */
export function StatsRevenueHeatmap({
  cells,
  tzOffsetMinutes,
  className,
}: StatsRevenueHeatmapProps) {
  const { t, i18n } = useTranslation()
  const numberLocale = statsNumberLocale(i18n.language)

  const { grid, max, peak } = useMemo(() => {
    const acc = new Map<string, number>()
    for (const cell of cells) {
      const bucket = Math.floor(cell.hour / 4) * 4
      const key = `${cell.weekday}-${bucket}`
      acc.set(key, (acc.get(key) ?? 0) + cell.revenue_rub)
    }
    let peakKey: string | null = null
    let peakValue = 0
    for (const [key, value] of acc) {
      if (value > peakValue) {
        peakValue = value
        peakKey = key
      }
    }
    return { grid: acc, max: peakValue, peak: peakKey }
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

  const short = (value: number) => {
    if (value <= 0) return ''
    if (value >= 1000) return `${(Math.round(value / 100) / 10).toLocaleString(numberLocale)}k`
    return String(Math.round(value))
  }

  const peakLabel = useMemo(() => {
    if (!peak || max <= 0) return null
    const [day, bucket] = peak.split('-').map(Number)
    return t('admin.stats.heatmapPeakLine', {
      day: weekdayNames[day - 1],
      from: String(bucket).padStart(2, '0'),
      to: String(bucket + 4).padStart(2, '0'),
      value: formatRub(max, numberLocale),
    })
  }, [peak, max, weekdayNames, t, numberLocale])

  return (
    <StatsPanel className={className}>
      <StatsPanelHead
        icon={Clock}
        color={STATS_ACCENT.cyan}
        title={t('admin.stats.heatmapTitle')}
        subtitle={t('admin.stats.heatmapSubtitle')}
        actions={
          <span className="shrink-0 rounded-lg border border-border/50 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
            {tzLabel}
          </span>
        }
      />

      <div className="grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))] items-center gap-1">
        <div />
        {BUCKETS.map((b) => (
          <div key={b} className="text-center text-[11px] tabular-nums text-muted-foreground">
            {String(b).padStart(2, '0')}–{String(b + 4).padStart(2, '0')}
          </div>
        ))}

        {WEEKDAYS.map((day) => (
          <Row
            key={day}
            name={weekdayNames[day - 1]}
            values={BUCKETS.map((b) => grid.get(`${day}-${b}`) ?? 0)}
            max={max}
            format={short}
            title={(bucketIndex, value) =>
              `${weekdayNames[day - 1]} ${String(BUCKETS[bucketIndex]).padStart(2, '0')}:00 — ${formatRub(value, numberLocale)}`
            }
          />
        ))}
      </div>

      <p className="mt-3.5 text-xs leading-snug text-muted-foreground">
        {peakLabel ?? t('admin.stats.heatmapEmpty')}
      </p>
    </StatsPanel>
  )
}

function Row({
  name,
  values,
  max,
  format,
  title,
}: {
  name: string
  values: number[]
  max: number
  format: (value: number) => string
  title: (bucketIndex: number, value: number) => string
}) {
  return (
    <>
      <div className="text-xs text-muted-foreground">{name}</div>
      {values.map((value, i) => {
        const alpha = max > 0 && value > 0 ? 0.07 + (0.68 * value) / max : 0
        return (
          <div
            key={i}
            title={title(i, value)}
            className="rounded-lg py-2 text-center text-[11px] tabular-nums"
            style={{
              backgroundColor:
                alpha > 0 ? `rgba(14, 173, 241, ${alpha.toFixed(3)})` : 'hsl(var(--muted) / 0.35)',
            }}
          >
            {format(value)}
          </div>
        )
      })}
    </>
  )
}
