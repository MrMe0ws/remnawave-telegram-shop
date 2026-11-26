import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Minus, Plus, Receipt, Wallet } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { AdminModal } from '../components/AdminModal'
import { NodeSidePanel } from '../nodes/NodeSidePanel'
import { daysUntil, formatDate, formatMoney, formatShortDate, startOfDay, type InfraNode } from './infraModel'
import {
  DateChips,
  DueBadge,
  FieldLabel,
  MoneyInput,
  NodeFlag,
  PayPreview,
  PeriodChips,
  ProviderIcon,
  chipClass,
  parseAmount,
} from './infraBits'
import type { InfraPayInput } from './useInfraActions'

function SubmitButton({ amount, disabled, paying, onClick, big }: { amount: number; disabled: boolean; paying: boolean; onClick: () => void; big?: boolean }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={disabled || paying}
      onClick={onClick}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 bg-emerald-500 font-semibold text-emerald-950 shadow-[0_6px_18px_-8px_rgb(16_185_129)] transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-45',
        big ? 'h-[50px] rounded-[14px] text-[15px]' : 'h-10 rounded-[11px] text-sm',
        paying && '!opacity-100',
      )}
    >
      {paying ? <Spinner /> : <Check className="size-4" strokeWidth={3} aria-hidden />}
      {t('admin.infra.pay.submit', { amount: formatMoney(amount) })}
    </button>
  )
}

function Step({ n, children, aside }: { n: number; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
      <span className="inline-flex size-[19px] items-center justify-center rounded-md bg-primary/20 text-[11px] text-primary">{n}</span>
      {children}
      {aside && <span className="ml-auto font-normal">{aside}</span>}
    </div>
  )
}

/**
 * Вариант B — «Счёт провайдера»: провайдер → его ноды галочками → одна запись на общую сумму,
 * даты всех отмеченных нод сдвигаются. На ПК — панель справа, на телефоне — шторка.
 */
export function InfraBillPay({
  open,
  onClose,
  nodes,
  allProviders,
  initialProvider,
  initialNode,
  mobile,
  paying,
  onPay,
}: {
  open: boolean
  onClose: () => void
  nodes: InfraNode[]
  /** Все провайдеры панели: оплатить можно и провайдера без нод — тогда только запись в историю. */
  allProviders: { uuid: string; name: string; faviconLink: string }[]
  initialProvider?: string | null
  initialNode?: string | null
  mobile: boolean
  paying: boolean
  onPay: (p: InfraPayInput) => Promise<boolean>
}) {
  const { t, i18n } = useTranslation()

  // Провайдеры, у которых есть ноды; первым — у кого ближе срок.
  const providers = useMemo(() => {
    const map = new Map<string, { uuid: string; name: string; favicon: string; nodes: InfraNode[]; next: number }>()
    for (const n of nodes) {
      let p = map.get(n.providerUuid)
      if (!p) {
        p = { uuid: n.providerUuid, name: n.providerName, favicon: n.providerFavicon, nodes: [], next: Infinity }
        map.set(n.providerUuid, p)
      }
      p.nodes.push(n)
      p.next = Math.min(p.next, n.nextBillingAt.getTime())
    }
    for (const p of allProviders) {
      if (!map.has(p.uuid)) map.set(p.uuid, { uuid: p.uuid, name: p.name, favicon: p.faviconLink, nodes: [], next: Infinity })
    }
    for (const p of map.values()) p.nodes.sort((a, b) => a.nextBillingAt.getTime() - b.nextBillingAt.getTime())
    return [...map.values()].sort((a, b) => a.next - b.next)
  }, [nodes, allProviders])

  const [prov, setProv] = useState<string | null>(initialProvider ?? null)
  const provider = providers.find((p) => p.uuid === prov) ?? null
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (initialNode) return new Set([initialNode])
    const first = providers.find((p) => p.uuid === initialProvider)?.nodes[0]
    return first ? new Set([first.billingUuid]) : new Set()
  })
  const picked = provider ? provider.nodes.filter((n) => selected.has(n.billingUuid)) : []
  const autoSum = picked.reduce((s, n) => s + (n.price ?? 0), 0)
  const unknown = picked.filter((n) => n.price == null).length
  const [amountText, setAmountText] = useState<string | null>(null)
  const amountStr = amountText ?? (autoSum ? autoSum.toFixed(2) : '')
  const amount = parseAmount(amountStr)
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [period, setPeriod] = useState<number>(() => picked[0]?.periodMonths ?? 1)

  const chooseProvider = (uuid: string) => {
    setProv(uuid)
    const first = providers.find((p) => p.uuid === uuid)?.nodes[0]
    setSelected(first ? new Set([first.billingUuid]) : new Set())
    if (first) setPeriod(first.periodMonths)
    setAmountText(null)
  }
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const canSubmit = !!provider && amount > 0
  const submit = async () => {
    if (!provider || !canSubmit) return
    const ok = await onPay({
      providerUuid: provider.uuid,
      providerName: provider.name,
      amount,
      billedAt: date,
      periodMonths: period,
      nodes: picked,
      prices: Object.fromEntries(picked.map((n) => [n.billingUuid, n.price ?? undefined])),
    })
    if (ok) onClose()
  }

  const body = (
    <div className="flex flex-col gap-5">
      <div>
        <Step n={1}>{t('admin.infra.bill.provider')}</Step>
        <div className={cn('flex gap-1.5', mobile ? '-mx-4 overflow-x-auto px-4 [scrollbar-width:none]' : 'flex-wrap')}>
          {providers.map((p) => (
            <button key={p.uuid} type="button" className={chipClass(prov === p.uuid)} onClick={() => chooseProvider(p.uuid)}>
              <ProviderIcon name={p.name} favicon={p.favicon} size="xs" />
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Step
          n={2}
          aside={
            provider && provider.nodes.length > 1 ? (
              <button type="button" className="text-primary hover:underline" onClick={() => setSelected(new Set(provider.nodes.map((n) => n.billingUuid)))}>
                {t('admin.infra.bill.selectAll')}
              </button>
            ) : null
          }
        >
          {t('admin.infra.bill.nodes')}
        </Step>
        {!provider ? (
          <p className="text-[12.5px] text-muted-foreground">{t('admin.infra.bill.pickProviderFirst')}</p>
        ) : provider.nodes.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">{t('admin.infra.bill.providerNoNodes')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {provider.nodes.map((n, i) => {
              const on = selected.has(n.billingUuid)
              return (
                <button
                  key={n.billingUuid}
                  type="button"
                  onClick={() => toggle(n.billingUuid)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    'grid animate-fade-in grid-cols-[20px_24px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200',
                    on ? 'border-emerald-500/60 bg-emerald-500/[0.07]' : 'border-border/60 bg-background/40 hover:border-border',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-md border-[1.5px] transition-all duration-200',
                      on ? 'border-emerald-500 bg-emerald-500 text-emerald-950' : 'border-border bg-background',
                    )}
                  >
                    <Check className={cn('size-3 transition-all duration-200', on ? 'scale-100 opacity-100' : 'scale-50 opacity-0')} strokeWidth={3.5} aria-hidden />
                  </span>
                  <NodeFlag code={n.countryCode} className="h-[15px] w-[22px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{n.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <DueBadge date={n.nextBillingAt} className="h-[18px] px-1.5 text-[10.5px]" />
                      {formatShortDate(n.nextBillingAt, i18n.language)}
                    </span>
                  </span>
                  <span className="text-right text-[13px] font-semibold tabular-nums">
                    {n.price != null ? formatMoney(n.price) : '—'}
                    <span className="block text-[10.5px] font-normal text-muted-foreground">/ {t('admin.infra.periodShort', { count: n.periodMonths })}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div>
        <Step n={3}>{t('admin.infra.bill.amount')}</Step>
        <MoneyInput large value={amountStr} onChange={(v) => setAmountText(v)} onEnter={() => void submit()} ariaLabel={t('admin.infra.bill.amount')} />
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          {unknown > 0 ? t('admin.infra.bill.unknownPrices', { count: unknown }) : t('admin.infra.bill.amountHint')}
        </p>
      </div>
      <div className={cn('grid gap-4', !mobile && 'grid-cols-2')}>
        <div>
          <FieldLabel>{t('admin.infra.pay.date')}</FieldLabel>
          <DateChips value={date} onChange={setDate} />
        </div>
        <div>
          <FieldLabel>{t('admin.infra.pay.extend')}</FieldLabel>
          <PeriodChips value={period} onChange={setPeriod} />
        </div>
      </div>
      <div>
        <FieldLabel>{t('admin.infra.bill.newDates')}</FieldLabel>
        <PayPreview nodes={picked} periodMonths={period} column />
      </div>
    </div>
  )

  const footer = (
    <div className="flex flex-col gap-2.5">
      {provider && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {t('admin.infra.bill.summaryRecord', { amount: formatMoney(amount), provider: provider.name })}
          <br />
          {picked.length > 0
            ? t('admin.infra.bill.summaryShift', { count: picked.length, period: period === 12 ? t('admin.infra.pay.plusYear') : t('admin.infra.pay.plusMonths', { count: period }) })
            : t('admin.infra.bill.summaryNoNodes')}
        </div>
      )}
      <SubmitButton amount={amount} disabled={!canSubmit} paying={paying} onClick={() => void submit()} big={mobile} />
    </div>
  )

  if (mobile) {
    return (
      <AdminModal open={open} onClose={onClose} title={t('admin.infra.bill.title')} description={t('admin.infra.bill.subtitle')} icon={Receipt} iconAccent="emerald" footer={footer}>
        {body}
      </AdminModal>
    )
  }
  return (
    <NodeSidePanel
      open={open}
      onClose={onClose}
      icon={Receipt}
      title={
        <div>
          {t('admin.infra.bill.title')}
          <div className="mt-0.5 text-xs font-normal text-muted-foreground">{t('admin.infra.bill.subtitle')}</div>
        </div>
      }
      footer={footer}
      widthClassName="sm:w-[480px]"
    >
      {body}
    </NodeSidePanel>
  )
}

/** Вариант A на телефоне: шторка подтверждения оплаты одной ноды. */
export function InfraNodePaySheet({
  node,
  onClose,
  paying,
  onPay,
}: {
  node: InfraNode | null
  onClose: () => void
  paying: boolean
  onPay: (p: InfraPayInput) => Promise<boolean>
}) {
  const { t, i18n } = useTranslation()
  // Шторка закрывается с анимацией — пока она уезжает, держим последнюю ноду.
  const [shown, setShown] = useState<InfraNode | null>(node)
  if (node && node !== shown) setShown(node)
  const n = node ?? shown
  return (
    <AdminModal
      open={!!node}
      onClose={onClose}
      title={n?.name ?? ''}
      description={n ? `${n.providerName} · ${formatDate(n.nextBillingAt, i18n.language)}` : undefined}
      icon={Wallet}
      iconAccent="emerald"
    >
      {n && <NodePaySheetBody key={n.billingUuid} node={n} paying={paying} onPay={onPay} onClose={onClose} />}
    </AdminModal>
  )
}

function NodePaySheetBody({ node, paying, onPay, onClose }: { node: InfraNode; paying: boolean; onPay: (p: InfraPayInput) => Promise<boolean>; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const [amountStr, setAmountStr] = useState(node.price != null ? node.price.toFixed(2) : '')
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [period, setPeriod] = useState(node.periodMonths)
  const amount = parseAmount(amountStr)
  const step = (d: number) => setAmountStr(Math.max(0, (parseAmount(amountStr) || 0) + d).toFixed(2))
  const submit = async () => {
    if (!amount) return
    const ok = await onPay({ providerUuid: node.providerUuid, providerName: node.providerName, amount, billedAt: date, periodMonths: period, nodes: [node] })
    if (ok) onClose()
  }
  const days = daysUntil(node.nextBillingAt)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <NodeFlag code={node.countryCode} className="h-5 w-[30px]" />
        <DueBadge date={node.nextBillingAt} />
        {days < 0 && <span className="text-xs text-muted-foreground">{formatShortDate(node.nextBillingAt, i18n.language)}</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" aria-label="−" onClick={() => step(-0.5)} className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border border-border/70 bg-secondary active:scale-95">
          <Minus className="size-5" aria-hidden />
        </button>
        <MoneyInput large value={amountStr} onChange={setAmountStr} className="h-[52px] flex-1 justify-center [&_input]:text-center [&_input]:text-2xl" ariaLabel={t('admin.infra.pay.amount')} />
        <button type="button" aria-label="+" onClick={() => step(0.5)} className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border border-border/70 bg-secondary active:scale-95">
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      <div>
        <FieldLabel>{t('admin.infra.pay.date')}</FieldLabel>
        <DateChips value={date} onChange={setDate} />
      </div>
      <div>
        <FieldLabel>{t('admin.infra.pay.extend')}</FieldLabel>
        <PeriodChips value={period} onChange={setPeriod} scroll />
      </div>
      <PayPreview nodes={[node]} periodMonths={period} />
      <SubmitButton big amount={amount} disabled={!amount} paying={paying} onClick={() => void submit()} />
    </div>
  )
}
