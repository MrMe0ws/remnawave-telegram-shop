import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { AdminInfraHistoryRecordDTO, AdminInfraMonthDTO, AdminInfraNodesStatsDTO } from '@/lib/types/admin'
import {
  daysUntil,
  formatDate,
  formatMoney,
  formatShortDate,
  localeOf,
  monthlyCost,
  urgencyOf,
  type InfraNode,
  type InfraStats,
} from './infraModel'
import { NodeFlag, ProviderIcon, useDueText } from './infraBits'

// Админские цифры показываем сразу, без «набегания» (решение владельца 26.11.2026).
function Money({ value }: { value: number }) {
  return <>{formatMoney(value)}</>
}

function Kpi({ label, children, sub, tone, extra, className }: { label: string; children: React.ReactNode; sub?: React.ReactNode; tone?: 'warn'; extra?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card/85 px-4 py-3.5',
        tone === 'warn' ? 'border-amber-500/40 bg-[linear-gradient(rgb(245_158_11/0.07),rgb(245_158_11/0.07))]' : 'border-border/55',
        className,
      )}
    >
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-[22px] font-bold tabular-nums tracking-tight', tone === 'warn' && 'text-amber-500')}>{children}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>}
      {extra}
    </div>
  )
}

export function InfraKpis({
  stats,
  panelStats,
  months,
  mobile,
}: {
  stats: InfraStats
  panelStats: AdminInfraNodesStatsDTO
  months: AdminInfraMonthDTO[]
  mobile: boolean
}) {
  const { t, i18n } = useTranslation()
  const cur = months[months.length - 1]
  const paidThisMonth = cur?.total ?? panelStats.currentMonthPayments
  // Просроченные ноды прошлых месяцев сюда не входят — только сроки этого месяца.
  const plan = paidThisMonth + stats.curMonthDueSum
  const maxMonth = Math.max(1, ...months.map((m) => m.total))
  const nextMonthName = stats.nextMonthDate.toLocaleDateString(localeOf(i18n.language), { month: 'long' })
  const curMonthName = new Date().toLocaleDateString(localeOf(i18n.language), { month: 'long' })
  const cards = [
    <Kpi
      key="week"
      label={t('admin.infra.kpi.week')}
      tone={stats.weekCount ? 'warn' : undefined}
      sub={
        <>
          {t('admin.infra.kpi.nodes', { count: stats.weekCount })}
          {stats.overdueCount > 0 && ` · ${t('admin.infra.kpi.overdue', { count: stats.overdueCount })}`}
          {stats.weekUnknown > 0 && ` · ${t('admin.infra.kpi.noPrice', { count: stats.weekUnknown })}`}
        </>
      }
    >
      <Money value={stats.weekSum} />
    </Kpi>,
    <Kpi
      key="next"
      label={t('admin.infra.kpi.forecast', { month: nextMonthName })}
      sub={
        <>
          {t('admin.infra.kpi.payments', { count: stats.nextMonthCount })}
          {stats.nextMonthUnknown > 0 && ` · ${t('admin.infra.kpi.noPrice', { count: stats.nextMonthUnknown })}`}
        </>
      }
    >
      <Money value={stats.nextMonthSum} />
    </Kpi>,
    <Kpi
      key="paid"
      label={t('admin.infra.kpi.paidIn', { month: curMonthName })}
      sub={t('admin.infra.kpi.ofPlan', { amount: formatMoney(plan) })}
      extra={
        <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-border/70">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${plan > 0 ? Math.min(100, (paidThisMonth / plan) * 100) : 0}%` }} />
        </div>
      }
    >
      <Money value={paidThisMonth} />
    </Kpi>,
    <Kpi
      key="total"
      label={t('admin.infra.kpi.total')}
      sub={t('admin.infra.kpi.allTime')}
      extra={
        !mobile && (
          <div className="absolute bottom-3 right-3 flex h-[30px] items-end gap-[3px]" aria-hidden>
            {months.map((m, i) => (
              <i
                key={m.month}
                className={cn('w-1.5 rounded-sm transition-[height] duration-700', i === months.length - 1 ? 'bg-primary' : 'bg-primary/45')}
                style={{ height: `${4 + (m.total / maxMonth) * 26}px` }}
              />
            ))}
          </div>
        )
      }
    >
      <Money value={panelStats.totalSpent} />
    </Kpi>,
  ]
  if (mobile) {
    return (
      <div className="-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
        {cards.map((c) => (
          // Две карточки на экран, все одной ширины и высоты (по самой высокой); остальные — свайпом.
          <div key={c.key} className="flex w-[calc(50%-4px)] shrink-0 snap-start [&>*]:flex-1">
            {c}
          </div>
        ))}
      </div>
    )
  }
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cards}</div>
}

/** Лента «ближайшие 30 дней»: флаги нод на оси, сегодня — синяя черта, просрочка — красная зона. */
export function InfraTimeline({ nodes, onPick }: { nodes: InfraNode[]; onPick: (n: InfraNode) => void }) {
  const { t, i18n } = useTranslation()
  const dueText = useDueText()
  const FROM = -5
  const TO = 35
  const pos = (k: number) => ((k - FROM) / (TO - FROM)) * 100
  const { byDay, later, earlier } = useMemo(() => {
    const map = new Map<number, InfraNode[]>()
    let later = 0
    let earlier = 0
    for (const n of nodes) {
      const k = daysUntil(n.nextBillingAt)
      if (k > TO) later++
      else if (k < FROM) earlier++
      else map.set(k, [...(map.get(k) ?? []), n])
    }
    return { byDay: [...map.entries()], later, earlier }
  }, [nodes])
  const ticks: number[] = []
  for (let k = FROM; k <= TO; k += 5) ticks.push(k)
  const today = new Date()
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 px-4 pb-3.5 pt-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px] font-semibold">
        {t('admin.infra.timeline.title')}
        <span className="text-[11.5px] font-normal text-muted-foreground">
          {t('admin.infra.timeline.hint')}
          {earlier > 0 && ` · ${t('admin.infra.timeline.earlier', { count: earlier })}`}
          {later > 0 && ` · ${t('admin.infra.timeline.later', { count: later })}`}
        </span>
      </div>
      <div className="relative h-[70px]">
        <div className="absolute inset-x-0 bottom-4 h-0.5 rounded bg-border" />
        <div className="absolute bottom-3 left-0 h-2.5 rounded bg-red-500/15" style={{ width: `${pos(0)}%` }} />
        {ticks.map((k) => (
          <span key={k} className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground" style={{ left: `${pos(k)}%` }}>
            {formatShortDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + k), i18n.language)}
          </span>
        ))}
        <div className="absolute bottom-3 top-0 w-0.5 -translate-x-1/2 rounded bg-primary" style={{ left: `${pos(0)}%` }}>
          <span className="absolute -top-0.5 left-1.5 whitespace-nowrap text-[10px] font-semibold text-primary">{t('admin.infra.timeline.today')}</span>
        </div>
        {byDay.map(([k, list]) => {
          const u = urgencyOf(k)
          return (
            <div
              key={k}
              className="absolute bottom-[22px] flex -translate-x-1/2 flex-col-reverse gap-0.5 transition-[left] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ left: `${pos(k)}%` }}
            >
              {list.map((n) => (
                <button
                  key={n.billingUuid}
                  type="button"
                  title={`${n.name} · ${n.providerName} · ${n.price != null ? formatMoney(n.price) : '?'} · ${formatDate(n.nextBillingAt, i18n.language)} (${dueText(n.nextBillingAt)})`}
                  onClick={() => onPick(n)}
                  className={cn(
                    'rounded-[5px] border bg-card p-0.5 leading-[0] transition-transform duration-200 hover:z-[2] hover:scale-125 hover:border-primary',
                    u === 'bad' ? 'border-red-500/80' : u === 'warn' ? 'border-amber-500/80' : 'border-border',
                  )}
                >
                  <NodeFlag code={n.countryCode} className="h-[11px] w-4 rounded-[2px]" />
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function InfraAside({
  months,
  nodes,
  recent,
  forecast,
  onShowHistory,
}: {
  months: AdminInfraMonthDTO[]
  nodes: InfraNode[]
  recent: AdminInfraHistoryRecordDTO[]
  /** Прогноз на следующий месяц — пунктирный столбец справа. */
  forecast: { date: Date; value: number }
  onShowHistory: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = localeOf(i18n.language)
  const bars = months.map((m, i) => ({
    key: m.month,
    label: new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)) - 1, 1).toLocaleDateString(locale, { month: 'short' }).replace('.', ''),
    value: m.total,
    cur: i === months.length - 1,
    fc: false,
  }))
  bars.push({
    key: 'forecast',
    label: forecast.date.toLocaleDateString(locale, { month: 'short' }).replace('.', ''),
    value: forecast.value,
    cur: false,
    fc: true,
  })
  const max = Math.max(1, ...bars.map((b) => b.value))

  const providers = useMemo(() => {
    const map = new Map<string, { name: string; favicon: string; count: number; monthly: number }>()
    for (const n of nodes) {
      const p = map.get(n.providerUuid) ?? { name: n.providerName, favicon: n.providerFavicon, count: 0, monthly: 0 }
      p.count++
      p.monthly += monthlyCost(n)
      map.set(n.providerUuid, p)
    }
    return [...map.values()].sort((a, b) => b.monthly - a.monthly).slice(0, 5)
  }, [nodes])
  const pmax = Math.max(1, ...providers.map((p) => p.monthly))

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-2xl border border-border/55 bg-card/75">
        <h3 className="border-b border-border/45 px-4 py-3 text-[13.5px] font-semibold">{t('admin.infra.aside.byMonth')}</h3>
        <div className="flex h-[124px] items-end gap-2.5 px-4 pt-4">
          {bars.map((b) => (
            <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <em className="text-[10.5px] font-semibold not-italic tabular-nums text-foreground/85">{b.value ? Math.round(b.value) : ''}</em>
              <i
                className={cn(
                  'w-full max-w-[30px] rounded-t-md rounded-b-sm transition-[height] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  b.fc
                    ? 'border border-dashed border-primary/60 bg-[repeating-linear-gradient(135deg,hsl(var(--primary)/0.25)_0_4px,transparent_4px_8px)]'
                    : b.cur
                      ? 'bg-primary'
                      : 'bg-primary/40',
                )}
                style={{ height: `${Math.max(3, (b.value / max) * 78)}px` }}
              />
              <span className="text-[10.5px] text-muted-foreground">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 px-4 pb-3 pt-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-[3px] bg-primary" />
            {t('admin.infra.aside.paid')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="size-2.5 rounded-[3px] border border-dashed border-primary" />
            {t('admin.infra.aside.forecast')}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 border-t border-border/40 px-4 pb-3.5 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.infra.aside.providers')}</div>
          {providers.map((p) => (
            <div key={p.name} className="grid grid-cols-[20px_1fr_auto] items-center gap-x-2 gap-y-1 text-[12.5px]">
              <ProviderIcon name={p.name} favicon={p.favicon} size="sm" />
              <span className="truncate">
                {p.name} <span className="text-[11px] text-muted-foreground">· {t('admin.infra.kpi.nodes', { count: p.count })}</span>
              </span>
              <b className="font-semibold tabular-nums">{t('admin.infra.aside.perMonth', { amount: formatMoney(p.monthly) })}</b>
              <div className="col-start-2 col-end-4 h-1 overflow-hidden rounded-full bg-border/60">
                <div className="h-full rounded-full bg-primary/75 transition-[width] duration-1000" style={{ width: `${(p.monthly / pmax) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border/55 bg-card/75">
        <h3 className="border-b border-border/45 px-4 py-3 text-[13.5px] font-semibold">{t('admin.infra.aside.recent')}</h3>
        <div className="px-1.5 py-1">
          {recent.length === 0 && <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">{t('admin.infra.noHistory')}</p>}
          {recent.map((r) => (
            <div key={r.uuid} className="flex animate-fade-in items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] transition-colors hover:bg-secondary/50">
              <ProviderIcon name={r.provider?.name ?? ''} favicon={r.provider?.faviconLink} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{r.provider?.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {r.nodes?.length ? `${r.nodes.map((n) => n.name).join(', ')} · ` : ''}
                  {formatDate(new Date(r.billedAt), i18n.language)}
                </div>
              </div>
              <b className="font-semibold tabular-nums">{formatMoney(r.amount)}</b>
            </div>
          ))}
        </div>
        <button type="button" onClick={onShowHistory} className="px-4 pb-3 text-xs text-primary hover:underline">
          {t('admin.infra.aside.allHistory')}
        </button>
      </div>
    </div>
  )
}
