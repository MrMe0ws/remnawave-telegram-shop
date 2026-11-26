import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarDays } from 'lucide-react'

import { cn } from '@/lib/utils'
import { AdminDatePicker } from '../components/AdminDatePicker'
import { CountryFlag } from '../components/CountryFlag'
import { PromoPopover } from '../promos/PromoBits'
import { faviconSrcFromUrl } from '../utils/normalizeUrl'
import {
  PERIOD_CHOICES,
  addMonthsClamped,
  daysUntil,
  formatDate,
  formatShortDate,
  startOfDay,
  urgencyOf,
  type InfraNode,
  type Urgency,
} from './infraModel'

const LETTER_COLORS = ['#e11d48', '#7c3aed', '#0891b2', '#ea580c', '#2563eb', '#db2777', '#16a34a', '#ca8a04', '#7e22ce', '#0d9488']

function colorFor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return LETTER_COLORS[h % LETTER_COLORS.length]
}

/** Фавикон провайдера; нет или не загрузился — цветная плитка с первой буквой. */
export function ProviderIcon({ name, favicon, size = 'sm', className }: { name: string; favicon?: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const [broken, setBroken] = useState(false)
  const src = favicon ? faviconSrcFromUrl(favicon) : undefined
  const box = { xs: 'size-4 rounded text-[9px]', sm: 'size-5 rounded-md text-[10px]', md: 'size-7 rounded-lg text-xs', lg: 'size-9 rounded-xl text-sm' }[size]
  if (src && !broken) {
    return <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('shrink-0 bg-white/5 object-cover', box, className)} />
  }
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center font-extrabold text-white', box, className)} style={{ background: colorFor(name || '?') }}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export function NodeFlag({ code, className }: { code?: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-secondary', className)}>
      <CountryFlag code={code} className="h-full w-full object-cover" />
    </span>
  )
}

export const urgencyBadgeClass: Record<Urgency, string> = {
  bad: 'bg-red-500/15 text-red-600 dark:text-red-300',
  warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  soon: 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-200',
  ok: 'bg-secondary text-foreground/80',
}

export const urgencyBarClass: Record<Urgency, string> = {
  bad: 'bg-red-500',
  warn: 'bg-amber-500',
  soon: 'bg-yellow-400/80',
  ok: 'bg-primary/70',
}

export function useDueText() {
  const { t } = useTranslation()
  return (d: Date) => {
    const days = daysUntil(d)
    if (days < 0) return t('admin.infra.due.overdue', { count: -days })
    if (days === 0) return t('admin.infra.due.today')
    if (days === 1) return t('admin.infra.due.tomorrow')
    return t('admin.infra.due.in', { count: days })
  }
}

export function DueBadge({ date, className }: { date: Date; className?: string }) {
  const dueText = useDueText()
  const u = urgencyOf(daysUntil(date))
  return (
    <span className={cn('inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-md px-2 text-[11.5px] font-semibold', urgencyBadgeClass[u], className)}>
      {dueText(date)}
    </span>
  )
}

export function chipClass(active: boolean) {
  return cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-[13px] transition-all duration-200 active:scale-[0.97]',
    active
      ? 'border-primary bg-primary/15 font-semibold text-primary'
      : 'border-border/70 bg-background/40 text-foreground/85 hover:border-primary/50',
  )
}

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('mb-1.5 block text-[11.5px] font-medium text-muted-foreground', className)}>{children}</span>
}

/** Поле суммы со знаком валюты. */
export function MoneyInput({
  value,
  onChange,
  autoFocus,
  large,
  className,
  onEnter,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  large?: boolean
  className?: string
  onEnter?: () => void
  ariaLabel?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (!autoFocus) return
    const id = window.setTimeout(() => {
      ref.current?.focus()
      ref.current?.select()
    }, 260)
    return () => window.clearTimeout(id)
  }, [autoFocus])
  return (
    <label
      className={cn(
        'flex items-center rounded-[11px] border border-border/80 bg-background/60 px-3 transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/20',
        large ? 'h-12' : 'h-10',
        className,
      )}
    >
      <span className="font-semibold text-muted-foreground">$</span>
      <input
        ref={ref}
        aria-label={ariaLabel}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        className={cn('w-full min-w-0 !bg-transparent pl-1 font-bold tabular-nums outline-none focus-visible:!shadow-none', large ? 'text-lg' : 'text-[15px]')}
      />
    </label>
  )
}

export function parseAmount(v: string): number {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

/** «Сегодня / Вчера / дата из календаря». */
export function DateChips({ value, onChange, className }: { value: Date; onChange: (d: Date) => void; className?: string }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const today = startOfDay(new Date())
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const day = startOfDay(value).getTime()
  const isToday = day === today.getTime()
  const isYesterday = day === yesterday.getTime()
  const custom = !isToday && !isYesterday
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      <button type="button" className={chipClass(isToday)} onClick={() => onChange(today)}>
        {t('admin.infra.pay.today')}
      </button>
      <button type="button" className={chipClass(isYesterday)} onClick={() => onChange(yesterday)}>
        {t('admin.infra.pay.yesterday')}
      </button>
      <button ref={btnRef} type="button" className={chipClass(custom)} onClick={() => setOpen((v) => !v)}>
        <CalendarDays className="size-3.5" aria-hidden />
        {custom ? formatDate(value, i18n.language) : t('admin.infra.pay.otherDate')}
      </button>
      <PromoPopover anchorRef={btnRef} open={open} onClose={() => setOpen(false)} width={300} label={t('admin.infra.pay.otherDate')}>
        <AdminDatePicker
          value={value}
          showTime={false}
          onChange={(d) => {
            onChange(startOfDay(d))
            setOpen(false)
          }}
        />
      </PromoPopover>
    </div>
  )
}

/** Период продления: +1 / +3 / +6 мес / +1 год (и текущий, если он нестандартный). */
export function PeriodChips({ value, onChange, className, scroll }: { value: number; onChange: (m: number) => void; className?: string; scroll?: boolean }) {
  const { t } = useTranslation()
  const choices: number[] = [...PERIOD_CHOICES]
  if (!choices.includes(value)) choices.splice(choices.findIndex((c) => c > value) === -1 ? choices.length : choices.findIndex((c) => c > value), 0, value)
  return (
    <div className={cn('flex gap-1.5', scroll ? 'overflow-x-auto [scrollbar-width:none]' : 'flex-wrap', className)}>
      {choices.map((m) => (
        <button key={m} type="button" className={chipClass(value === m)} onClick={() => onChange(m)}>
          {m === 12 ? t('admin.infra.pay.plusYear') : t('admin.infra.pay.plusMonths', { count: m })}
        </button>
      ))}
    </div>
  )
}

/** «Латвия: 24.11 → 24.12.2026» для каждой оплачиваемой ноды. */
export function PayPreview({ nodes, periodMonths, className, column }: { nodes: InfraNode[]; periodMonths: number; className?: string; column?: boolean }) {
  const { t, i18n } = useTranslation()
  if (!nodes.length) return <p className={cn('text-[12.5px] text-muted-foreground', className)}>{t('admin.infra.pay.pickNodes')}</p>
  return (
    <div className={cn('flex gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground', column ? 'flex-col' : 'flex-wrap', className)}>
      {nodes.map((n) => (
        <span key={n.billingUuid} className="inline-flex min-w-0 items-center gap-1.5">
          <NodeFlag code={n.countryCode} className="h-3 w-[18px]" />
          <span className="truncate">{n.name}:</span>
          <span className="tabular-nums">{formatShortDate(n.nextBillingAt, i18n.language)}</span>
          <ArrowRight className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
          <b className="font-semibold tabular-nums text-foreground">{formatDate(addMonthsClamped(n.nextBillingAt, periodMonths), i18n.language)}</b>
        </span>
      ))}
    </div>
  )
}

/** Сегменты с подложкой, которая переезжает к выбранному. */
export function SlidingTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  stretch,
}: {
  tabs: { key: T; label: ReactNode; icon?: ReactNode; count?: number }[]
  value: T
  onChange: (key: T) => void
  className?: string
  stretch?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLButtonElement>(`[data-tab="${value}"]`)
    if (!el) return
    const place = () => setInd({ left: el.offsetLeft, width: el.offsetWidth })
    place()
    const ro = new ResizeObserver(place)
    ro.observe(wrap.current!)
    return () => ro.disconnect()
  }, [value, tabs.length])
  return (
    <div
      ref={wrap}
      role="tablist"
      className={cn('relative inline-flex rounded-xl border border-border/55 bg-card/80 p-[3px]', stretch && 'flex w-full', className)}
    >
      {ind && (
        <span
          aria-hidden
          className="absolute bottom-[3px] top-[3px] rounded-[9px] border border-primary/35 bg-primary/15 transition-[left,width] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ left: ind.left, width: ind.width }}
        />
      )}
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          data-tab={tab.key}
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'relative z-[1] inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[9px] px-4 py-1.5 text-[13px] transition-colors duration-200',
            stretch && 'flex-1 px-2',
            value === tab.key ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count != null && <span className="rounded-md bg-secondary px-1.5 text-[11px] font-medium text-muted-foreground">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
