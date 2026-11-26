import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Check, DollarSign, ExternalLink, Globe, History, Plus, Search, Server, Trash2, X } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminLayout } from '../layout/AdminLayout'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { PromoPopover, PromoPopoverItem } from '../promos/PromoBits'
import { normalizeHttpUrl } from '../utils/normalizeUrl'
import { buildInfraNodes, formatMoney, infraStats, type InfraNode } from '../infra/infraModel'
import { SlidingTabs } from '../infra/infraBits'
import { InfraNodeList, type InlinePayValues } from '../infra/InfraNodeList'
import { InfraAside, InfraKpis, InfraTimeline } from '../infra/InfraOverviewParts'
import { InfraBillPay, InfraNodePaySheet } from '../infra/InfraPayDialogs'
import { InfraAddNodeModal, InfraBell, InfraEditDateModal, InfraPriceModal, InfraProviderModal, type ProviderDraft } from '../infra/InfraModals'
import { InfraHistoryTab, InfraProvidersTab } from '../infra/InfraTabs'
import { INFRA_QUERY_KEYS, useDeferredRemove, useFlash, useInfraPay } from '../infra/useInfraActions'

type TabKey = 'nodes' | 'providers' | 'history'

/**
 * Инфраструктура: биллинг нод и провайдеров (данные — в панели Remnawave,
 * цены/периоды нод и связь «оплата → ноды» — у нас).
 * Главное действие — «Оплачено»: запись в историю провайдера и сдвиг даты ноды одним шагом.
 * На ПК одна нода оплачивается прямо в строке (вариант A), счёт провайдера — панелью справа (B).
 */
export default function AdminInfraPage() {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const [tab, setTab] = useState<TabKey>('nodes')
  const [q, setQ] = useState('')

  const overview = useQuery({ queryKey: INFRA_QUERY_KEYS.overview, queryFn: () => api.adminInfraOverview() })
  const providersQ = useQuery({ queryKey: INFRA_QUERY_KEYS.providers, queryFn: () => api.adminInfraProviders() })
  const providers = useMemo(() => providersQ.data?.providers ?? [], [providersQ.data])

  const nodeRemove = useDeferredRemove()
  const provRemove = useDeferredRemove()
  const histRemove = useDeferredRemove()

  const allNodes = useMemo(() => (overview.data ? buildInfraNodes(overview.data) : []), [overview.data])
  const nodes = useMemo(() => allNodes.filter((n) => !nodeRemove.hidden.has(n.billingUuid)), [allNodes, nodeRemove.hidden])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? nodes.filter((n) => `${n.name} ${n.providerName}`.toLowerCase().includes(needle)) : nodes
  }, [nodes, q])
  const stats = useMemo(() => infraStats(nodes), [nodes])

  const { flash, trigger } = useFlash()
  const { pay, paying } = useInfraPay(trigger)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bill, setBill] = useState<{ key: number; provider?: string | null; node?: string | null } | null>(null)
  const [billOpen, setBillOpen] = useState(false)
  const [sheetNode, setSheetNode] = useState<InfraNode | null>(null)
  const [menu, setMenu] = useState<{ node: InfraNode; anchor: HTMLElement } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [dateNode, setDateNode] = useState<InfraNode | null>(null)
  const [priceNode, setPriceNode] = useState<InfraNode | null>(null)
  const [providerDraft, setProviderDraft] = useState<ProviderDraft | null>(null)

  const openBill = (provider?: string | null, node?: string | null) => {
    setBill({ key: Date.now(), provider, node })
    setBillOpen(true)
  }

  const inlinePay = useCallback(
    async (n: InfraNode, v: InlinePayValues) => {
      const ok = await pay({ providerUuid: n.providerUuid, providerName: n.providerName, amount: v.amount, billedAt: v.billedAt, periodMonths: v.periodMonths, nodes: [n] })
      if (ok) setExpanded(null)
      return ok
    },
    [pay],
  )
  const swipePay = useCallback(
    async (n: InfraNode) => {
      if (n.price == null) return
      await pay({ providerUuid: n.providerUuid, providerName: n.providerName, amount: n.price, billedAt: new Date(), periodMonths: n.periodMonths, nodes: [n] })
    },
    [pay],
  )
  const startPay = (n: InfraNode) => {
    setMenu(null)
    if (mobile) setSheetNode(n)
    else {
      setTab('nodes')
      setExpanded(n.billingUuid)
    }
  }
  const removeNode = (n: InfraNode) => {
    setMenu(null)
    if (expanded === n.billingUuid) setExpanded(null)
    nodeRemove.remove(n.billingUuid, () => api.adminInfraDeleteNode(n.billingUuid), t('admin.infra.toast.nodeRemoved', { node: n.name }), t('admin.infra.toast.nodeRemovedHint'))
  }
  const goToNode = (n: InfraNode) => {
    const el = document.querySelector(`[data-infra-row="${n.billingUuid}"]`) ?? document.getElementById(`infra-row-${n.billingUuid}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    trigger([n.billingUuid])
  }

  const tabs = [
    { key: 'nodes' as const, label: t('admin.infra.tabs.nodes'), icon: <Server className="size-4" aria-hidden />, count: mobile ? undefined : nodes.length },
    { key: 'providers' as const, label: t('admin.infra.tabs.providers'), icon: <Globe className="size-4" aria-hidden />, count: mobile ? undefined : providers.length },
    { key: 'history' as const, label: t('admin.infra.tabs.history'), icon: <History className="size-4" aria-hidden />, count: mobile ? undefined : overview.data?.historyTotal },
  ]

  const loading = overview.isLoading
  const failed = overview.isError

  return (
    <AdminLayout>
      <div className={cn('space-y-4', mobile && 'pb-24')}>
        <AdminPageHeader
          icon={Server}
          title={t('admin.infra.title')}
          subtitle={
            overview.data
              ? t('admin.infra.subtitleStats', { nodes: nodes.length, providers: providers.length, monthly: formatMoney(stats.monthlyTotal) })
              : t('admin.infra.subtitle')
          }
          accent="slate"
          actionsEnd
          actions={
            <div className="flex items-center gap-2">
              <InfraBell />
              {!mobile && (
                <>
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border/70 bg-secondary px-3.5 text-[13px] font-semibold transition-all hover:bg-secondary/70 active:scale-[0.97] disabled:opacity-50"
                  >
                    <Plus className="size-4" aria-hidden />
                    {t('admin.infra.addNodeShort')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openBill()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_6px_18px_-8px_hsl(var(--primary))] transition-all hover:bg-primary/90 active:scale-[0.97]"
                  >
                    {t('admin.infra.recordPayment')}
                  </button>
                </>
              )}
            </div>
          }
        />

        <SlidingTabs tabs={tabs} value={tab} onChange={(k) => (setTab(k), setExpanded(null))} stretch={mobile} />

        {failed ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-center text-sm text-muted-foreground">{t('admin.infra.loadError')}</div>
        ) : loading ? (
          <InfraSkeleton mobile={mobile} />
        ) : tab === 'nodes' ? (
          <>
            <InfraKpis stats={stats} panelStats={overview.data!.stats} months={overview.data!.months} mobile={mobile} />
            {!mobile && <InfraTimeline nodes={nodes} onPick={goToNode} />}
            <div className={cn(!mobile && 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]')}>
              <div className={cn(!mobile && 'rounded-2xl border border-border/55 bg-card/75')}>
                <div className={cn('flex items-center gap-2.5', mobile ? 'mt-1' : 'border-b border-border/45 px-4 py-3')}>
                  {!mobile && <h3 className="text-[13.5px] font-semibold">{t('admin.infra.tabs.nodes')}</h3>}
                  <label className="flex h-9 flex-1 items-center gap-2 rounded-[10px] border border-border/60 bg-background/50 px-2.5 text-muted-foreground sm:max-w-[260px]">
                    <Search className="size-3.5 shrink-0" aria-hidden />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.infra.searchPlaceholder')} className="w-full !bg-transparent text-[13px] text-foreground outline-none focus-visible:!shadow-none" />
                    {q && (
                      <button type="button" onClick={() => setQ('')} aria-label="✕">
                        <X className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </label>
                  {mobile && (
                    <button
                      type="button"
                      aria-label={t('admin.infra.addNodeShort')}
                      onClick={() => setAddOpen(true)}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border/70 bg-secondary disabled:opacity-50"
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                {mobile && nodes.length > 0 && <p className="mx-1 mt-3 text-[11.5px] text-muted-foreground">{t('admin.infra.swipeHint')}</p>}
                <div className={cn(!mobile && 'pt-1')}>
                  {!shown.length ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{nodes.length ? t('admin.infra.nothingFound') : t('admin.infra.noNodes')}</p>
                  ) : (
                    <InfraNodeList
                      nodes={shown}
                      mobile={mobile}
                      flash={flash}
                      expanded={expanded}
                      onExpand={setExpanded}
                      onInlinePay={inlinePay}
                      paying={paying}
                      onMenu={(node, anchor) => setMenu({ node, anchor })}
                      onMobilePay={(n) => setSheetNode(n)}
                      onSwipePay={swipePay}
                    />
                  )}
                </div>
              </div>
              {!mobile && <InfraAside months={overview.data!.months} nodes={nodes} recent={overview.data!.recent} forecast={{ date: stats.nextMonthDate, value: stats.nextMonthSum }} onShowHistory={() => setTab('history')} />}
            </div>
          </>
        ) : tab === 'providers' ? (
          <InfraProvidersTab
            providers={providers}
            nodes={nodes}
            hidden={provRemove.hidden}
            mobile={mobile}
            onPay={(p) => openBill(p)}
            onEdit={setProviderDraft}
            onDelete={(p) => provRemove.remove(p.uuid, () => api.adminInfraDeleteProvider(p.uuid), t('admin.infra.toast.providerRemoved', { provider: p.name }))}
          />
        ) : (
          <InfraHistoryTab
            providers={providers}
            hidden={histRemove.hidden}
            mobile={mobile}
            onDelete={(r) =>
              histRemove.remove(r.uuid, () => api.adminInfraDeleteHistory(r.uuid), t('admin.infra.toast.historyRemoved', { amount: formatMoney(r.amount) }), r.provider?.name)
            }
          />
        )}
      </div>

      {mobile && tab !== 'history' && !loading && !failed && (
        <button
          type="button"
          onClick={() => openBill()}
          className="fixed inset-x-3 bottom-[calc(1rem+var(--cabinet-sheet-safe-bottom))] z-[150] inline-flex h-[50px] items-center justify-center gap-2 rounded-[15px] bg-primary text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary))] transition-transform active:scale-[0.98]"
        >
          <Plus className="size-5" aria-hidden />
          {t('admin.infra.recordPayment')}
        </button>
      )}

      {menu && (
        <PromoPopover anchorRef={{ current: menu.anchor }} open onClose={() => setMenu(null)} align="right" width={270} label={t('admin.infra.menu.title')}>
          <PromoPopoverItem icon={<Check className="size-4" />} onClick={() => startPay(menu.node)}>
            {t('admin.infra.menu.pay')}
          </PromoPopoverItem>
          <PromoPopoverItem icon={<CalendarDays className="size-4" />} onClick={() => (setDateNode(menu.node), setMenu(null))}>
            {t('admin.infra.menu.date')}
          </PromoPopoverItem>
          <PromoPopoverItem icon={<DollarSign className="size-4" />} onClick={() => (setPriceNode(menu.node), setMenu(null))}>
            {t('admin.infra.menu.price')}
          </PromoPopoverItem>
          {menu.node.providerLoginUrl && (
            <PromoPopoverItem
              icon={<ExternalLink className="size-4" />}
              onClick={() => {
                window.open(normalizeHttpUrl(menu.node.providerLoginUrl), '_blank', 'noopener,noreferrer')
                setMenu(null)
              }}
            >
              {t('admin.infra.menu.cabinet', { provider: menu.node.providerName })}
            </PromoPopoverItem>
          )}
          <div className="my-1.5 border-t border-border/60" />
          <PromoPopoverItem danger icon={<Trash2 className="size-4" />} onClick={() => removeNode(menu.node)}>
            {t('admin.infra.menu.remove')}
          </PromoPopoverItem>
        </PromoPopover>
      )}

      {bill && (
        <InfraBillPay
          key={bill.key}
          open={billOpen}
          onClose={() => setBillOpen(false)}
          nodes={nodes}
          allProviders={providers}
          initialProvider={bill.provider}
          initialNode={bill.node}
          mobile={mobile}
          paying={paying}
          onPay={pay}
        />
      )}
      <InfraNodePaySheet node={sheetNode} onClose={() => setSheetNode(null)} paying={paying} onPay={pay} />
      <InfraAddNodeModal open={addOpen} onClose={() => setAddOpen(false)} available={overview.data?.availableBillingNodes ?? []} providers={providers} />
      <InfraEditDateModal node={dateNode} onClose={() => setDateNode(null)} />
      <InfraPriceModal node={priceNode} onClose={() => setPriceNode(null)} />
      <InfraProviderModal draft={providerDraft} onClose={() => setProviderDraft(null)} />
    </AdminLayout>
  )
}

function InfraSkeleton({ mobile }: { mobile: boolean }) {
  return (
    <div className="space-y-4">
      <div className={cn('grid gap-3', mobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-4')}>
        {Array.from({ length: mobile ? 1 : 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      {!mobile && <Skeleton className="h-[110px] rounded-2xl" />}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
