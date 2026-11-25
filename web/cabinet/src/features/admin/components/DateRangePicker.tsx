import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Выбор диапазона дат: кнопка-поле с периодом и всплывающее окно — слева быстрые пресеты,
 * справа календарь (дни → месяцы → годы). Даты — строки YYYY-MM-DD по местному времени.
 */

export interface DateRange {
  start: string
  end: string
}

export interface DateRangePreset {
  key: string
  label: string
  range: DateRange
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

type Mode = 'days' | 'months' | 'years'

const POPOVER_W = 460
const GAP = 6
const MARGIN = 12

interface Pos {
  left: number
  top: number
  width: number
}

export function DateRangePicker({
  value,
  onChange,
  maxDate,
  presets,
  ariaLabel,
  className,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Последняя доступная дата (YYYY-MM-DD); по умолчанию — сегодня. */
  maxDate?: string
  presets?: DateRangePreset[]
  ariaLabel?: string
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'ru-RU'
  const max = useMemo(() => dayStart((maxDate && parseYmd(maxDate)) || new Date()), [maxDate])

  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos | null>(null)

  const [mode, setMode] = useState<Mode>('days')
  const [viewYear, setViewYear] = useState(max.getFullYear())
  const [viewMonth, setViewMonth] = useState(max.getMonth())
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)

  const startD = parseYmd(value.start)
  const endD = parseYmd(value.end)

  const fmt = useCallback(
    (s: string) => {
      const d = parseYmd(s)
      if (!d) return '—'
      const mon = d.toLocaleDateString(locale, { month: 'short' })
      return `${d.getDate()} ${mon}, ${d.getFullYear()}`
    },
    [locale],
  )

  const openPicker = () => {
    const base = endD ?? max
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    setMode('days')
    setAnchor(null)
    setHover(null)
    setOpen(true)
  }
  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }, [])

  // Клик вне окна.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const n = e.target as Node
      if (popRef.current?.contains(n) || triggerRef.current?.contains(n)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  // Esc: оболочка боковой панели ловит его на document в фазе перехвата. Слушатель на window
  // в той же фазе срабатывает раньше и гасит событие, так что первым закрывается календарь.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, close])

  // Позиция: под кнопкой по её правому краю, в пределах экрана; не помещается снизу — открываем вверх.
  const place = useCallback(() => {
    const tr = triggerRef.current
    if (!tr) return
    const r = tr.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(POPOVER_W, vw - MARGIN * 2)
    const left = Math.max(MARGIN, Math.min(r.right - width, vw - MARGIN - width))
    const h = popRef.current?.offsetHeight ?? 340
    let top = r.bottom + GAP
    if (top + h > vh - MARGIN && r.top - GAP - h >= MARGIN) top = r.top - GAP - h
    else top = Math.max(MARGIN, Math.min(top, vh - MARGIN - h))
    setPos({ left, top, width })
  }, [])
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
  }, [open, mode, place])
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  const monthShort = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2024, i, 1).toLocaleDateString(locale, { month: 'short' })),
    [locale],
  )
  const monthLong = useMemo(() => {
    const s = new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, { month: 'long' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }, [viewYear, viewMonth, locale])
  const weekdays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })),
    [locale],
  )

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const offset = (first.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(viewYear, viewMonth, 1 - offset + i)
      return { date: d, inMonth: d.getMonth() === viewMonth }
    })
  }, [viewYear, viewMonth])

  const decadeStart = Math.floor(viewYear / 10) * 10
  const maxY = max.getFullYear()
  const maxM = max.getMonth()
  const nextDisabled =
    mode === 'days'
      ? viewYear > maxY || (viewYear === maxY && viewMonth >= maxM)
      : mode === 'months'
        ? viewYear >= maxY
        : decadeStart + 10 > maxY

  const prev = () => {
    if (mode === 'days') {
      const d = new Date(viewYear, viewMonth - 1, 1)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else if (mode === 'months') setViewYear((y) => y - 1)
    else setViewYear((y) => y - 10)
  }
  const next = () => {
    if (nextDisabled) return
    if (mode === 'days') {
      const d = new Date(viewYear, viewMonth + 1, 1)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else if (mode === 'months') setViewYear((y) => y + 1)
    else setViewYear((y) => Math.min(y + 10, maxY))
  }

  const pickDay = (d: Date) => {
    if (d > max) return
    if (!anchor) {
      setAnchor(d)
      setHover(null)
      return
    }
    const [a, b] = anchor <= d ? [anchor, d] : [d, anchor]
    onChange({ start: toYmd(a), end: toYmd(b) })
    setAnchor(null)
    close()
  }

  // Подсвеченный диапазон: пока выбор не закончен — от первой даты до даты под курсором.
  const hiA = anchor ?? startD
  const hiB = anchor ? (hover ?? anchor) : endD
  const [lo, hi] = hiA && hiB ? (hiA <= hiB ? [hiA, hiB] : [hiB, hiA]) : [null, null]
  const today = dayStart(new Date())

  const nav =
    'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30'
  const gridBtn = 'rounded-lg px-2 py-3 text-sm tabular-nums transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-30'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'flex h-10 min-w-0 items-center gap-2 rounded-[10px] border border-input bg-card dark:bg-background/60 px-2.5 text-left text-[13px] outline-none transition-colors hover:border-primary/50 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20',
          open && 'border-primary/60 ring-2 ring-primary/20',
          className,
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate tabular-nums">
          {fmt(value.start)} – {fmt(value.end)}
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.width ?? POPOVER_W, visibility: pos ? 'visible' : 'hidden' }}
            className="fixed z-[260] flex overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
          >
            {presets && presets.length > 0 && (
              <div className="flex w-[8.5rem] shrink-0 flex-col gap-0.5 border-r border-border/70 bg-muted/30 p-1.5">
                {presets.map((p) => {
                  const active = p.range.start === value.start && p.range.end === value.end
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        onChange(p.range)
                        setAnchor(null)
                        close()
                      }}
                      className={cn(
                        'rounded-lg px-2.5 py-2 text-left text-[13px] whitespace-nowrap transition-colors',
                        active ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground/90 hover:bg-accent',
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="min-w-0 flex-1 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-1">
                <button type="button" className={nav} onClick={prev} aria-label={t('admin.prev')}>
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                {mode === 'years' ? (
                  <span className="text-sm font-semibold tabular-nums">
                    {decadeStart} – {decadeStart + 9}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'days' ? 'months' : 'years')}
                    className="rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors hover:bg-accent"
                  >
                    {mode === 'days' ? `${monthLong} ${viewYear}` : viewYear}
                  </button>
                )}
                <button type="button" className={nav} onClick={next} disabled={nextDisabled} aria-label={t('admin.next')}>
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>

              {mode === 'days' && (
                <>
                  <div className="mb-1 grid grid-cols-7">
                    {weekdays.map((w, i) => (
                      <div
                        key={w}
                        className={cn('py-1 text-center text-[11px] font-medium capitalize', i >= 5 ? 'text-red-500/80' : 'text-muted-foreground')}
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
                    {cells.map(({ date, inMonth }, i) => {
                      const future = date > max
                      const inRange = lo != null && hi != null && date >= lo && date <= hi
                      const isLo = lo != null && date.getTime() === lo.getTime()
                      const isHi = hi != null && date.getTime() === hi.getTime()
                      const edge = inRange && (isLo || isHi)
                      const weekend = i % 7 >= 5
                      return (
                        <button
                          key={date.getTime()}
                          type="button"
                          disabled={future}
                          onClick={() => pickDay(date)}
                          onMouseEnter={() => anchor && setHover(date)}
                          className={cn(
                            'h-9 text-[13px] tabular-nums transition-colors',
                            future && 'pointer-events-none opacity-30',
                            !inMonth && !edge && 'opacity-45',
                            weekend && !edge && 'text-red-500 dark:text-red-400',
                            inRange && !edge && 'bg-primary/20',
                            edge && 'bg-primary font-semibold text-primary-foreground',
                            edge && isLo && 'rounded-l-lg',
                            edge && isHi && 'rounded-r-lg',
                            !inRange && 'rounded-lg hover:bg-accent',
                            !inRange && date.getTime() === today.getTime() && 'ring-1 ring-primary/40',
                          )}
                        >
                          {date.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {mode === 'months' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {monthShort.map((label, i) => {
                    const future = viewYear > maxY || (viewYear === maxY && i > maxM)
                    const current = endD != null && endD.getFullYear() === viewYear && endD.getMonth() === i
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={future}
                        onClick={() => {
                          setViewMonth(i)
                          setMode('days')
                        }}
                        className={cn(gridBtn, current && 'bg-primary/15 font-semibold text-primary')}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

              {mode === 'years' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i).map((y) => {
                    const outside = y < decadeStart || y > decadeStart + 9
                    const current = endD != null && endD.getFullYear() === y
                    return (
                      <button
                        key={y}
                        type="button"
                        disabled={y > maxY}
                        onClick={() => {
                          setViewYear(y)
                          setMode('months')
                        }}
                        className={cn(gridBtn, outside && 'opacity-45', current && 'bg-primary/15 font-semibold text-primary')}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
