import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'

import { cn } from '@/lib/utils'
import { AdminDatePicker } from '../../components/AdminDatePicker'
import type { StatsCustomRange } from '../utils/statsPeriod'

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

interface StatsCustomRangePickerProps {
  active: boolean
  value: StatsCustomRange | null
  onApply: (range: StatsCustomRange) => void
  className?: string
}

export function StatsCustomRangePicker({
  active,
  value,
  onApply,
  className,
}: StatsCustomRangePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const today = useMemo(() => startOfDay(new Date()), [])

  const defaultFrom = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 30)
    return d
  }, [today])

  const [fromDate, setFromDate] = useState<Date>(() =>
    value ? parseIsoDate(value.from) : defaultFrom,
  )
  const [toDate, setToDate] = useState<Date>(() => (value ? parseIsoDate(value.to) : today))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (value) {
      setFromDate(parseIsoDate(value.from))
      setToDate(parseIsoDate(value.to))
    }
    setError(null)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const apply = () => {
    const from = startOfDay(fromDate)
    const to = startOfDay(toDate)
    if (from.getTime() > to.getTime()) {
      setError(t('admin.stats.customRange.invalidOrder'))
      return
    }
    const maxFrom = new Date(today)
    maxFrom.setMonth(maxFrom.getMonth() - 35)
    maxFrom.setDate(1)
    if (from.getTime() < startOfDay(maxFrom).getTime()) {
      setError(t('admin.stats.customRange.tooLong'))
      return
    }
    setError(null)
    onApply({ from: toIsoDate(from), to: toIsoDate(to) })
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('admin.stats.customRange.open')}
        aria-expanded={open}
        title={t('admin.stats.customRange.open')}
        className={cn(
          'cabinet-elevated-card inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-accent/40',
          (open || active) && 'border-primary/40 ring-1 ring-primary/20 text-primary',
        )}
      >
        <Calendar className="size-4" />
      </button>

      {open && (
        <div className="cabinet-elevated-card absolute right-0 z-50 mt-1.5 w-[min(100vw-1.5rem,20rem)] space-y-3 rounded-lg border border-border/60 bg-card p-3 shadow-lg sm:w-[22rem]">
          <p className="text-sm font-medium">{t('admin.stats.customRange.title')}</p>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('admin.stats.customRange.from')}</p>
            <AdminDatePicker value={fromDate} onChange={setFromDate} showTime={false} />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('admin.stats.customRange.to')}</p>
            <AdminDatePicker value={toDate} onChange={setToDate} showTime={false} minDate={fromDate} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="button"
            onClick={apply}
            className="flex min-h-10 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t('admin.stats.customRange.apply')}
          </button>
        </div>
      )}
    </div>
  )
}
