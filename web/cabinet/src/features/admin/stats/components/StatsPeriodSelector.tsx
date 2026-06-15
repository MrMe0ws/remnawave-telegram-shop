import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import { STATS_PERIOD_OPTIONS, statsPeriodLabel, type StatsPeriod } from '../utils/statsPeriod'

interface StatsPeriodSelectorProps {
  value: StatsPeriod
  onChange: (period: StatsPeriod) => void
  className?: string
}

export function StatsPeriodSelector({ value, onChange, className }: StatsPeriodSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const pick = (period: StatsPeriod) => {
    onChange(period)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('admin.stats.period.label')}
        className={cn(
          'cabinet-elevated-card flex min-h-11 min-w-[9.5rem] items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/40',
          open && 'border-primary/40 ring-1 ring-primary/20',
        )}
      >
        <span>{statsPeriodLabel(t, value)}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('admin.stats.period.label')}
          className="cabinet-elevated-card absolute right-0 z-50 mt-1.5 min-w-full overflow-hidden rounded-lg border border-border/60 bg-card py-1 shadow-lg"
        >
          {STATS_PERIOD_OPTIONS.map((period) => {
            const selected = period === value
            return (
              <li key={period} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => pick(period)}
                  className={cn(
                    'flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                    selected && 'bg-primary/10 text-primary',
                  )}
                >
                  <span>{statsPeriodLabel(t, period)}</span>
                  {selected && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
