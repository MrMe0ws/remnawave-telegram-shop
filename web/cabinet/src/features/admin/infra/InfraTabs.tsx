import { useMemo, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import type { AdminInfraHistoryRecordDTO, AdminInfraProviderDTO } from '@/lib/types/admin'
import { AdminSelect } from '../components/AdminSelect'
import { PromoPopover, PromoPopoverItem } from '../promos/PromoBits'
import { normalizeHttpUrl } from '../utils/normalizeUrl'
import { formatDate, formatMoney, groupHistoryByMonth, localeOf, monthlyCost, type InfraNode } from './infraModel'
import { DueBadge, NodeFlag, ProviderIcon } from './infraBits'
import type { ProviderDraft } from './InfraModals'
import { INFRA_QUERY_KEYS } from './useInfraActions'

function hostOf(url: string): string {
  try {
    return new URL(normalizeHttpUrl(url)).host
  } catch {
    return url
  }
}

export function InfraProvidersTab({
  providers,
  nodes,
  hidden,
  mobile,
  onPay,
  onEdit,
  onDelete,
}: {
  providers: AdminInfraProviderDTO[]
  nodes: InfraNode[]
  hidden: Set<string>
  mobile: boolean
  onPay: (providerUuid: string) => void
  onEdit: (d: ProviderDraft) => void
  onDelete: (p: AdminInfraProviderDTO) => void
}) {
  const { t } = useTranslation()
  const rows = useMemo(
    () =>
      providers
        .filter((p) => !hidden.has(p.uuid))
        .map((p) => {
          const ns = nodes.filter((n) => n.providerUuid === p.uuid).sort((a, b) => a.nextBillingAt.getTime() - b.nextBillingAt.getTime())
          return { p, ns, monthly: ns.reduce((s, n) => s + monthlyCost(n), 0), next: ns[0] ?? null }
        })
        .sort((a, b) => (a.next?.nextBillingAt.getTime() ?? Infinity) - (b.next?.nextBillingAt.getTime() ?? Infinity)),
    [providers, nodes, hidden],
  )
  const add = () => onEdit({ name: '', favicon_link: '', login_url: '' })

  if (mobile) {
    return (
      <div className="flex flex-col gap-2">
        {rows.map(({ p, ns, monthly, next }, i) => (
          <div key={p.uuid} style={{ animationDelay: `${i * 35}ms` }} className="flex animate-fade-in items-center gap-3 rounded-[14px] border border-border/55 bg-card p-3">
            <ProviderIcon name={p.name} favicon={p.faviconLink} size="lg" />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(draftOf(p))}>
              <div className="truncate text-sm font-semibold">{p.name}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {t('admin.infra.kpi.nodes', { count: ns.length })} · {t('admin.infra.aside.perMonth', { amount: formatMoney(monthly) })}
                {next && ` · ${formatDate(next.nextBillingAt).slice(0, 5)}`}
              </div>
            </button>
            <button type="button" onClick={() => onPay(p.uuid)} className="h-8 shrink-0 rounded-[10px] border border-border/70 bg-secondary px-3 text-xs font-semibold">
              {t('admin.infra.providersTab.pay')}
            </button>
          </div>
        ))}
        <button type="button" onClick={add} className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-dashed border-border text-sm text-muted-foreground">
          <Plus className="size-4" aria-hidden />
          {t('admin.infra.addProvider')}
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {rows.map(({ p, ns, monthly, next }, i) => (
        <ProviderCard key={p.uuid} p={p} ns={ns} monthly={monthly} next={next} delay={i * 40} onPay={onPay} onEdit={onEdit} onDelete={onDelete} />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="size-5" aria-hidden />
        {t('admin.infra.addProvider')}
      </button>
    </div>
  )
}

function draftOf(p: AdminInfraProviderDTO): ProviderDraft {
  return { uuid: p.uuid, name: p.name, favicon_link: normalizeHttpUrl(p.faviconLink ?? ''), login_url: normalizeHttpUrl(p.loginUrl ?? '') }
}

function ProviderCard({
  p,
  ns,
  monthly,
  next,
  delay,
  onPay,
  onEdit,
  onDelete,
}: {
  p: AdminInfraProviderDTO
  ns: InfraNode[]
  monthly: number
  next: InfraNode | null
  delay: number
  onPay: (providerUuid: string) => void
  onEdit: (d: ProviderDraft) => void
  onDelete: (p: AdminInfraProviderDTO) => void
}) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-in rounded-2xl border border-border/55 bg-card/80 p-3.5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_14px_30px_-20px_hsl(var(--primary))]"
    >
      <div className="flex items-center gap-2.5">
        <ProviderIcon name={p.name} favicon={p.faviconLink} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">{p.name}</div>
          {p.loginUrl && <div className="truncate text-[11.5px] text-muted-foreground">{hostOf(p.loginUrl)}</div>}
        </div>
        <button
          ref={menuRef}
          type="button"
          aria-label={t('admin.infra.menu.title')}
          onClick={() => setMenu((v) => !v)}
          className="inline-flex size-8 items-center justify-center rounded-[9px] text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
        <PromoPopover anchorRef={menuRef} open={menu} onClose={() => setMenu(false)} align="right" width={200} label={t('admin.infra.menu.title')}>
          <PromoPopoverItem icon={<Pencil className="size-4" />} onClick={() => (setMenu(false), onEdit(draftOf(p)))}>
            {t('admin.infra.editProvider')}
          </PromoPopoverItem>
          <PromoPopoverItem danger icon={<Trash2 className="size-4" />} onClick={() => (setMenu(false), onDelete(p))}>
            {t('admin.infra.providersTab.delete')}
          </PromoPopoverItem>
        </PromoPopover>
      </div>
      <div className="my-3 flex min-h-5 flex-wrap gap-1">
        {ns.length ? ns.map((n) => <NodeFlag key={n.billingUuid} code={n.countryCode} className="h-[13px] w-5" />) : <span className="text-xs text-muted-foreground">{t('admin.infra.providersTab.noNodes')}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11.5px] text-muted-foreground">
        <div>
          {t('admin.infra.providersTab.perMonth')}
          <b className="block text-sm tabular-nums text-foreground">{formatMoney(monthly)}</b>
        </div>
        <div>
          {t('admin.infra.providersTab.total')}
          <b className="block text-sm tabular-nums text-foreground">{formatMoney(p.billingHistory?.totalAmount ?? 0)}</b>
        </div>
        <div className="col-span-2 flex min-w-0 items-center gap-1.5">
          {t('admin.infra.providersTab.next')}
          {next ? (
            <DueBadge date={next.nextBillingAt} className="min-w-0 truncate" />
          ) : (
            <span>—</span>
          )}
          {next && <span className="truncate">{next.name}</span>}
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {p.loginUrl && (
          <a
            href={normalizeHttpUrl(p.loginUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-border/70 bg-secondary text-xs font-semibold transition-colors hover:bg-secondary/70"
          >
            {t('admin.infra.cabinet')}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <button type="button" onClick={() => onPay(p.uuid)} className="h-[30px] flex-1 rounded-[9px] bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          {t('admin.infra.providersTab.pay')}
        </button>
      </div>
    </div>
  )
}

const HISTORY_PAGE = 50

function csvEscape(v: string): string {
  return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function InfraHistoryTab({
  providers,
  hidden,
  mobile,
  onDelete,
}: {
  providers: AdminInfraProviderDTO[]
  hidden: Set<string>
  mobile: boolean
  onDelete: (r: AdminInfraHistoryRecordDTO) => void
}) {
  const { t, i18n } = useTranslation()
  const [provider, setProvider] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const query = useInfiniteQuery({
    queryKey: [...INFRA_QUERY_KEYS.history, 'pages'],
    queryFn: ({ pageParam }) => api.adminInfraHistory(pageParam, HISTORY_PAGE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((s, p) => s + p.records.length, 0)
      return loaded < last.total && last.records.length ? loaded : undefined
    },
  })
  const all = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.records), [query.data])
  const total = query.data?.pages[0]?.total ?? 0
  const needle = q.trim().toLowerCase()
  const records = all.filter(
    (r) =>
      !hidden.has(r.uuid) &&
      (!provider || r.providerUuid === provider) &&
      (!needle || `${r.provider?.name ?? ''} ${(r.nodes ?? []).map((n) => n.name).join(' ')}`.toLowerCase().includes(needle)),
  )
  const months = groupHistoryByMonth(records)
  const locale = localeOf(i18n.language)

  const exportCsv = () => {
    const lines = [['date', 'provider', 'amount', 'nodes'].join(';')]
    for (const r of records) {
      lines.push([formatDate(new Date(r.billedAt), i18n.language), csvEscape(r.provider?.name ?? ''), r.amount.toFixed(2), csvEscape((r.nodes ?? []).map((n) => n.name).join(', '))].join(';'))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `infra-payments-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className={cn(!mobile && 'rounded-2xl border border-border/55 bg-card/75 p-3.5')}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className={cn('flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-border/60 bg-background/50 px-2.5 text-muted-foreground sm:max-w-[260px]', mobile && 'basis-full')}>
          <Search className="size-3.5 shrink-0" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.infra.history.search')} className="w-full !bg-transparent text-[13px] text-foreground outline-none focus-visible:!shadow-none" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="✕">
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </label>
        <AdminSelect
          value={provider}
          options={providers.map((p) => ({ value: p.uuid, label: p.name, icon: <ProviderIcon name={p.name} favicon={p.faviconLink} size="xs" /> }))}
          onChange={setProvider}
          allowEmpty
          emptyLabel={t('admin.infra.history.allProviders')}
          placeholder={t('admin.infra.history.allProviders')}
          ariaLabel={t('admin.infra.pickProvider')}
          // Телефон: поиск — своей строкой, ниже провайдер и CSV в одну строку.
          className={mobile ? 'min-w-0 flex-1' : 'w-52'}
        />
        {!mobile && <span className="flex-1" />}
        <button
          type="button"
          onClick={exportCsv}
          disabled={!records.length}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-border/70 bg-secondary px-3 text-[13px] font-semibold transition-colors hover:bg-secondary/70 disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden />
          CSV
        </button>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !records.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('admin.infra.noHistory')}</p>
      ) : (
        months.map((m) => (
          <div key={m.key} className="mb-3.5">
            <div className="flex items-baseline gap-2.5 px-1 pb-2">
              <b className="text-sm capitalize">{m.date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</b>
              <span className="text-xs text-muted-foreground">{t('admin.infra.history.count', { count: m.items.length })}</span>
              <span className="ml-auto font-bold tabular-nums">{formatMoney(m.total)}</span>
            </div>
            {m.items.map((r) => (
              <div
                key={r.uuid}
                className={cn(
                  'grid animate-fade-in items-center gap-3 rounded-[11px] px-2.5 py-2 transition-colors hover:bg-secondary/55',
                  mobile ? 'grid-cols-[28px_minmax(0,1fr)_auto_28px]' : 'grid-cols-[28px_minmax(0,1fr)_110px_90px_34px]',
                )}
              >
                <ProviderIcon name={r.provider?.name ?? ''} favicon={r.provider?.faviconLink} size="md" />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{r.provider?.name}</div>
                  {mobile && <div className="text-[11px] text-muted-foreground">{formatDate(new Date(r.billedAt), i18n.language)}</div>}
                  {!!r.nodes?.length && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.nodes.map((n) => (
                        <span key={n.nodeUuid} className="inline-flex items-center gap-1 rounded-md bg-secondary/70 py-px pl-1 pr-1.5 text-[11px] text-muted-foreground">
                          <NodeFlag code={n.countryCode} className="h-2.5 w-3.5 rounded-[2px]" />
                          {n.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {!mobile && <span className="text-[12.5px] tabular-nums text-muted-foreground">{formatDate(new Date(r.billedAt), i18n.language)}</span>}
                <span className="text-right font-bold tabular-nums">{formatMoney(r.amount)}</span>
                <button
                  type="button"
                  aria-label={t('admin.infra.history.delete')}
                  onClick={() => onDelete(r)}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ))
      )}
      {query.hasNextPage && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border/70 bg-secondary px-4 text-[13px] font-semibold"
          >
            {query.isFetchingNextPage && <Spinner />}
            {t('admin.infra.history.more', { loaded: all.length, total })}
          </button>
        </div>
      )}
    </div>
  )
}
