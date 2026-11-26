import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ExternalLink, MoreHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { normalizeHttpUrl } from '../utils/normalizeUrl'
import {
  daysUntil,
  formatDate,
  formatMoney,
  formatShortDate,
  groupInfraNodes,
  periodProgress,
  startOfDay,
  urgencyOf,
  type GroupKey,
  type InfraNode,
} from './infraModel'
import {
  DateChips,
  DueBadge,
  FieldLabel,
  MoneyInput,
  NodeFlag,
  PayPreview,
  PeriodChips,
  ProviderIcon,
  parseAmount,
  urgencyBarClass,
} from './infraBits'

const EASE = [0.22, 1, 0.36, 1] as const

const groupDot: Record<GroupKey, string> = {
  overdue: 'bg-red-500',
  week: 'bg-amber-500',
  month: 'bg-primary',
  later: 'bg-muted-foreground/60',
}

export type InlinePayValues = { amount: number; billedAt: Date; periodMonths: number }

export function PriceText({ node, className }: { node: InfraNode; className?: string }) {
  const { t } = useTranslation()
  if (node.price == null) return <span className={cn('text-muted-foreground', className)}>{t('admin.infra.priceUnknown')}</span>
  return (
    <span className={cn('tabular-nums', className)} title={node.priceSource === 'guess' ? t('admin.infra.priceGuessHint') : undefined}>
      {node.priceSource === 'guess' ? '~' : ''}
      {formatMoney(node.price)}
    </span>
  )
}

export function InfraNodeList({
  nodes,
  mobile,
  flash,
  expanded,
  onExpand,
  onInlinePay,
  paying,
  onMenu,
  onMobilePay,
  onSwipePay,
}: {
  nodes: InfraNode[]
  mobile: boolean
  flash: Set<string>
  expanded: string | null
  onExpand: (billingUuid: string | null) => void
  onInlinePay: (node: InfraNode, v: InlinePayValues) => Promise<boolean>
  paying: boolean
  onMenu: (node: InfraNode, anchor: HTMLElement) => void
  onMobilePay: (node: InfraNode) => void
  onSwipePay: (node: InfraNode) => Promise<void>
}) {
  const { t } = useTranslation()
  const [closed, setClosed] = useState<Set<GroupKey>>(() => new Set())
  const groups = groupInfraNodes(nodes)

  return (
    <LayoutGroup>
      {groups.map((g) => {
        const isClosed = closed.has(g.key)
        return (
          <section key={g.key} className={cn(mobile ? 'mt-4 first:mt-2' : 'pb-1')}>
            <button
              type="button"
              onClick={() =>
                setClosed((prev) => {
                  const next = new Set(prev)
                  if (next.has(g.key)) next.delete(g.key)
                  else next.add(g.key)
                  return next
                })
              }
              className={cn(
                'flex w-full items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground',
                mobile ? 'px-1 pb-2' : 'px-4 pb-1.5 pt-2.5',
              )}
            >
              <span className={cn('size-[7px] rounded-full', groupDot[g.key])} />
              {t(`admin.infra.groups.${g.key}`)} · {g.items.length}
              <span className="ml-auto font-medium normal-case tracking-normal tabular-nums">
                {formatMoney(g.sum)}
                {g.unknown > 0 && <span className="text-muted-foreground/70"> + ?</span>}
              </span>
              <ChevronDown className={cn('size-3.5 transition-transform duration-300', isClosed && '-rotate-90')} aria-hidden />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
                isClosed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <AnimatePresence initial={false}>
                  {g.items.map((n) =>
                    mobile ? (
                      <MobileCard key={n.billingUuid} node={n} flash={flash.has(n.billingUuid)} onPay={onMobilePay} onSwipePay={onSwipePay} onMenu={onMenu} />
                    ) : (
                      <DesktopRow
                        key={n.billingUuid}
                        node={n}
                        flash={flash.has(n.billingUuid)}
                        open={expanded === n.billingUuid}
                        onToggle={() => onExpand(expanded === n.billingUuid ? null : n.billingUuid)}
                        onInlinePay={onInlinePay}
                        paying={paying}
                        onMenu={onMenu}
                      />
                    ),
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        )
      })}
    </LayoutGroup>
  )
}

function rowMotion(reduce: boolean | null) {
  return {
    layout: 'position' as const,
    initial: reduce ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? undefined : { opacity: 0, x: 24, transition: { duration: 0.22 } },
    transition: { layout: { duration: 0.6, ease: EASE }, duration: 0.35, ease: EASE },
  }
}

function DesktopRow({
  node,
  flash,
  open,
  onToggle,
  onInlinePay,
  paying,
  onMenu,
}: {
  node: InfraNode
  flash: boolean
  open: boolean
  onToggle: () => void
  onInlinePay: (node: InfraNode, v: InlinePayValues) => Promise<boolean>
  paying: boolean
  onMenu: (node: InfraNode, anchor: HTMLElement) => void
}) {
  const { t, i18n } = useTranslation()
  const reduce = useReducedMotion()
  const u = urgencyOf(daysUntil(node.nextBillingAt))
  const loginUrl = node.providerLoginUrl ? normalizeHttpUrl(node.providerLoginUrl) : ''
  return (
    <motion.div
      layoutId={`infra-row-${node.billingUuid}`}
      data-infra-row={node.billingUuid}
      {...rowMotion(reduce)}
      className={cn(
        'group relative mx-2 mb-1.5 rounded-xl border transition-[background-color,border-color,box-shadow] duration-200',
        open
          ? 'border-primary/45 bg-secondary/70 shadow-[0_10px_30px_-18px_hsl(var(--primary))]'
          : 'border-transparent hover:border-border/50 hover:bg-secondary/55',
        flash && 'animate-infra-flash',
      )}
    >
      <div className="grid grid-cols-[26px_minmax(0,1.3fr)_88px_minmax(205px,1fr)_auto] items-center gap-3 px-2.5 py-2">
        <NodeFlag code={node.countryCode} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold">{node.name}</div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <ProviderIcon name={node.providerName} favicon={node.providerFavicon} size="xs" />
            <span className="truncate">{node.providerName}</span>
            {loginUrl && (
              <a
                href={loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                {t('admin.infra.cabinet')}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
        </div>
        <div className="text-right text-[13.5px] font-semibold">
          <PriceText node={node} />
          <div className="text-[11px] font-normal text-muted-foreground">/ {t('admin.infra.periodShort', { count: node.periodMonths })}</div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <DueBadge date={node.nextBillingAt} />
            <span className="tabular-nums">{formatDate(node.nextBillingAt, i18n.language)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-border/70">
            <div className={cn('h-full rounded-full transition-[width] duration-700', urgencyBarClass[u])} style={{ width: `${periodProgress(node)}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'inline-flex h-[30px] items-center gap-1.5 rounded-[9px] border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-[12.5px] font-semibold text-emerald-600 transition-all duration-200 hover:bg-emerald-500 hover:text-emerald-950 dark:text-emerald-300',
              // На мыши кнопка проявляется по наведению (кроме срочных); на тач-экране видна всегда.
              !open && (u === 'ok' || u === 'soon') && '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100',
            )}
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            {t('admin.infra.paid')}
          </button>
          <button
            type="button"
            aria-label={t('admin.infra.menu.title')}
            onClick={(e) => onMenu(node, e.currentTarget)}
            className="inline-flex size-[30px] items-center justify-center rounded-[9px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="inline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <InlinePay node={node} paying={paying} onCancel={onToggle} onSubmit={(v) => onInlinePay(node, v)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Вариант A: форма оплаты прямо в строке ноды. */
function InlinePay({
  node,
  paying,
  onCancel,
  onSubmit,
}: {
  node: InfraNode
  paying: boolean
  onCancel: () => void
  onSubmit: (v: InlinePayValues) => Promise<boolean>
}) {
  const { t, i18n } = useTranslation()
  const [amount, setAmount] = useState(node.price != null ? node.price.toFixed(2) : '')
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [period, setPeriod] = useState(node.periodMonths)
  const value = parseAmount(amount)
  const submit = () => {
    if (!value || paying) return
    void onSubmit({ amount: value, billedAt: date, periodMonths: period })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3.5 px-3 pb-3 pl-12 pt-1">
      <div className="w-36">
        <FieldLabel>{t('admin.infra.pay.amount')}</FieldLabel>
        <MoneyInput value={amount} onChange={setAmount} autoFocus onEnter={submit} ariaLabel={t('admin.infra.pay.amount')} />
        {node.lastPaidAt && (
          <span className="mt-1 block whitespace-nowrap text-[11px] text-muted-foreground">
            {t('admin.infra.pay.lastTime', {
              amount: node.lastPaidAmount != null ? formatMoney(node.lastPaidAmount) : '—',
              date: formatDate(node.lastPaidAt, i18n.language),
            })}
          </span>
        )}
      </div>
      <div>
        <FieldLabel>{t('admin.infra.pay.date')}</FieldLabel>
        <DateChips value={date} onChange={setDate} className="flex-nowrap" />
      </div>
      <div>
        <FieldLabel>{t('admin.infra.pay.extend')}</FieldLabel>
        <PeriodChips value={period} onChange={setPeriod} className="flex-nowrap" />
      </div>
      <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        <PayPreview nodes={[node]} periodMonths={period} />
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="h-9 rounded-[10px] border border-border/70 bg-secondary px-3.5 text-[13px] font-semibold transition-colors hover:bg-secondary/70">
          {t('admin.cancel')}
        </button>
        <button
          type="button"
          disabled={!value || paying}
          onClick={submit}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[10px] bg-emerald-500 px-4 text-[13px] font-semibold text-emerald-950 shadow-[0_6px_18px_-8px_rgb(16_185_129)] transition-all hover:bg-emerald-400 active:scale-[0.97] disabled:opacity-45',
            paying && '!opacity-100',
          )}
        >
          {paying ? <Spinner /> : <Check className="size-4" strokeWidth={3} aria-hidden />}
          {t('admin.infra.pay.submit', { amount: formatMoney(value) })}
        </button>
      </div>
    </div>
  )
}

const SWIPE_ARM_PX = 96

/** Телефон: смахнуть вправо — «оплачено» с прошлой суммой и периодом; ✓ — шторка с подтверждением. */
function MobileCard({
  node,
  flash,
  onPay,
  onSwipePay,
  onMenu,
}: {
  node: InfraNode
  flash: boolean
  onPay: (node: InfraNode) => void
  onSwipePay: (node: InfraNode) => Promise<void>
  onMenu: (node: InfraNode, anchor: HTMLElement) => void
}) {
  const { t, i18n } = useTranslation()
  const reduce = useReducedMotion()
  const u = urgencyOf(daysUntil(node.nextBillingAt))
  const inner = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; lock: 'x' | 'y' | null; id: number } | null>(null)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  // Тап без смахивания открывает меню ноды; после смахивания click не должен сработать.
  const dragged = useRef(false)

  const setX = (x: number, animate: boolean) => {
    const el = inner.current
    if (!el) return
    el.style.transition = animate ? 'transform .35s cubic-bezier(.22,1,.36,1)' : 'none'
    el.style.transform = x ? `translateX(${x}px)` : ''
  }

  const onDown = (e: ReactPointerEvent) => {
    if (busy || (e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, lock: null, id: e.pointerId }
    dragged.current = false
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.lock && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      d.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (d.lock === 'x') e.currentTarget.setPointerCapture(d.id)
      dragged.current = true
    }
    if (d.lock !== 'x') return
    d.dx = Math.max(0, Math.min(mx, 180))
    setX(d.dx, false)
    setArmed(d.dx > SWIPE_ARM_PX)
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d || d.lock !== 'x') return
    setArmed(false)
    if (d.dx > SWIPE_ARM_PX) {
      if (node.price == null) {
        // Сумму не знаем — без подтверждения не записываем.
        setX(0, true)
        onPay(node)
        return
      }
      setX(window.innerWidth, true)
      setBusy(true)
      void onSwipePay(node).finally(() => {
        setBusy(false)
        setX(0, true)
      })
    } else setX(0, true)
  }

  return (
    <motion.div
      layoutId={`infra-card-${node.billingUuid}`}
      {...rowMotion(reduce)}
      data-admin-no-edge-swipe
      className="relative mb-2 touch-pan-y select-none overflow-hidden rounded-[14px]"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="absolute inset-px flex items-center gap-2 rounded-[13px] bg-emerald-500 pl-[18px] text-[13px] font-bold text-emerald-950">
        <Check className={cn('size-5 transition-transform duration-200', armed && 'scale-125')} strokeWidth={3} aria-hidden />
        {busy ? <Spinner /> : t('admin.infra.paid')}
      </div>
      <div
        ref={inner}
        role="button"
        tabIndex={0}
        aria-label={t('admin.infra.menu.title')}
        onClick={(e) => {
          if (dragged.current || (e.target as HTMLElement).closest('button')) return
          onMenu(node, e.currentTarget)
        }}
        className={cn(
          'relative grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-[14px] border bg-card px-3 py-2.5',
          u === 'bad' ? 'border-red-500/45' : u === 'warn' ? 'border-amber-500/40' : 'border-border/55',
          flash && 'animate-infra-flash',
        )}
      >
        <NodeFlag code={node.countryCode} className="h-[15px] w-[22px]" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{node.name}</div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <ProviderIcon name={node.providerName} favicon={node.providerFavicon} size="xs" />
            <span className="truncate">{node.providerName}</span>
            <DueBadge date={node.nextBillingAt} className="h-[19px] px-1.5 text-[10.5px]" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <PriceText node={node} className="text-[13.5px] font-bold" />
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatShortDate(node.nextBillingAt, i18n.language)}</span>
        </div>
        <button
          type="button"
          aria-label={t('admin.infra.paid')}
          onClick={() => onPay(node)}
          className="inline-flex size-[34px] items-center justify-center rounded-[11px] border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 active:scale-95 dark:text-emerald-300"
        >
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </button>
      </div>
    </motion.div>
  )
}
